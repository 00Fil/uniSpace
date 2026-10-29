"""Trascrizione dell'audio con faster-whisper, tarata per lezioni di matematica:
massima precisione (modello grande, ricerca ampia, vocabolario del corso nel prompt) a costo di tempo."""
import json, os, re, subprocess, threading, time
from pathlib import Path

import mathspeech

MODEL = os.environ.get("STUDYCUT_WHISPER_MODEL", "large-v3")
MODELS_DIR = os.environ.get("STUDYCUT_MODELS") or None
THREADS = int(os.environ.get("STUDYCUT_WHISPER_THREADS", "0"))      # 0 = tutti i core
BEAM = int(os.environ.get("STUDYCUT_WHISPER_BEAM", "10"))

# parole che Whisper sbaglia di piu' in una lezione di matematica: nel prompt iniziale lo "orientano"
PROMPTS = {
    "it": ("Lezione universitaria di matematica: algebra lineare, geometria e analisi. Matrice, determinante, autovalori, autovettori, "
           "autospazio, polinomio caratteristico, spazio vettoriale, sottospazio, combinazione lineare, base, dimensione, rango, nucleo, "
           "immagine, applicazione lineare, isomorfismo, ortogonale, prodotto scalare, derivata, integrale, limite, serie, convergenza, "
           "successione, funzione continua, teorema, dimostrazione, ipotesi, tesi, per ogni, esiste, se e solo se. "
           "Si ha x al quadrato più 3 x meno 5 uguale a 0, f di x, lambda, epsilon, delta, R n."),
    "en": ("University mathematics lecture: linear algebra, geometry and calculus. Matrix, determinant, eigenvalues, eigenvectors, vector space, "
           "subspace, basis, dimension, rank, kernel, image, linear map, isomorphism, orthogonal, derivative, integral, limit, series, "
           "convergence, theorem, proof, for all, there exists, if and only if. We have x squared plus 3 x minus 5 equals 0, f of x."),
}
_model, _lock = None, threading.Lock()


def have_whisper():
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:
        return False


def get_model():
    global _model
    with _lock:
        if _model is None:
            from faster_whisper import WhisperModel
            device, ctype = "cpu", "int8"
            try:
                import ctranslate2
                if ctranslate2.get_cuda_device_count() > 0:
                    device, ctype = "cuda", "float16"
            except Exception:
                pass
            kw = {"device": device, "compute_type": ctype}
            if MODELS_DIR:
                kw["download_root"] = MODELS_DIR
            if THREADS and device == "cpu":
                kw["cpu_threads"] = THREADS
            _model = WhisperModel(MODEL, **kw)
        return _model


def load_audio(ffmpeg, src):
    """Audio 16 kHz mono come array numpy, con filtro passa-alto e volume uniforme (il parlato resta piu' chiaro
    per il modello). Passa da ffmpeg e non da PyAV: nessun file temporaneo e nessuna dipendenza fragile."""
    import numpy as np
    r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
                        "-af", "highpass=f=70,dynaudnorm=f=250:g=15:p=0.9", "-f", "s16le", "-"], capture_output=True)
    if r.returncode != 0 or not r.stdout:
        raise RuntimeError("Audio non estraibile: " + r.stderr.decode("utf-8", "ignore").strip()[-200:])
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def to_units(words):
    return mathspeech.convert([{"w": w.word, "s": round(w.start, 3), "e": round(w.end, 3)} for w in words if w.word.strip()])


def run(ffmpeg, src, language, on_segment, on_progress, alive, duration):
    """Trascrive e chiama on_segment(seg) per ogni frase appena pronta. Restituisce (lingua, modello)."""
    if not have_whisper():
        raise RuntimeError("faster-whisper non installato: esegui  pip install -U faster-whisper")
    on_progress(0.0, "Preparo l'audio...")
    audio = load_audio(ffmpeg, src)
    try:
        on_progress(0.0, "Carico il modello (la prima volta lo scarica)...")
        model = get_model()
        lang = None if language in (None, "", "auto") else language
        segs, info = model.transcribe(
            audio, language=lang, task="transcribe", beam_size=BEAM, best_of=5, patience=1.2,
            temperature=[0.0, 0.2, 0.4, 0.6], condition_on_previous_text=True,
            initial_prompt=PROMPTS.get(lang or "it", PROMPTS["it"]), word_timestamps=True,
            vad_filter=True, vad_parameters={"threshold": 0.4, "min_silence_duration_ms": 700, "speech_pad_ms": 300},
            no_speech_threshold=0.5, compression_ratio_threshold=2.2, log_prob_threshold=-1.0,
            hallucination_silence_threshold=2.0, repetition_penalty=1.05)
        n = 0
        for s in segs:
            if not alive():
                raise RuntimeError("Interrotta: video eliminato")
            words = s.words or []
            units = to_units(words) if words else [{"k": "w", "x": s.text.strip(), "s": round(s.start, 3), "e": round(s.end, 3)}]
            if units:
                on_segment({"id": n, "s": round(s.start, 3), "e": round(s.end, 3), "u": units})
                n += 1
            on_progress(min(0.99, s.end / max(duration, 1)), f"Trascrizione  {int(min(0.99, s.end / max(duration, 1)) * 100)}%")
        return info.language, MODEL
    finally:
        del audio


# ---------------------------------------------------------------- testo <-> unita' (modifica a mano ed esportazione)
def seg_text(seg):
    """Frase come testo con le formule fra $...$."""
    out = []
    for u in seg["u"]:
        out.append(f"${u['x']}${u.get('p', '')}" if u["k"] == "m" else u["x"])
    return " ".join(out)


def parse_text(text, s, e):
    """Testo con $...$ -> unita'; i tempi si ripartiscono in proporzione alla lunghezza."""
    parts = []
    for m in re.finditer(r"\$([^$]+)\$([.,;:!?]*)|(\S+)", text.replace("\n", " ")):
        if m.group(1) is not None:
            parts.append(("m", m.group(1).strip(), m.group(2) or ""))
        else:
            parts.append(("w", m.group(3), ""))
    if not parts:
        return []
    w = [max(1, len(x[1])) for x in parts]
    tot, t, units = float(sum(w)), s, []
    for (k, x, p), wi in zip(parts, w):
        d = (e - s) * wi / tot
        u = {"k": k, "x": x, "s": round(t, 3), "e": round(t + d, 3)}
        if k == "m":
            u["p"] = p
        units.append(u)
        t += d
    return units


def stamp(t):
    t = int(t)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


def export_txt(title, segs, stamps=True):
    lines = [title, "=" * min(len(title), 60), ""]
    for s in segs:
        lines.append((f"[{stamp(s['s'])}] " if stamps else "") + seg_text(s))
    return "\n".join(lines) + "\n"


def export_tex(title, segs):
    body, para, last = [], [], None
    for s in segs:
        if last is not None and s["s"] - last > 2.5 and para:
            body.append(" ".join(para)); para = []
        txt = []
        for u in s["u"]:
            txt.append(f"${u['x']}${mathspeech.esc_tex(u.get('p', ''))}" if u["k"] == "m" else mathspeech.esc_tex(u["x"]))
        stamp_t = f"\\textcolor{{gray}}{{\\scriptsize[{stamp(s['s'])}]}}~" if not para else ""
        para.append(stamp_t + " ".join(txt))
        last = s["e"]
    if para:
        body.append(" ".join(para))
    return ("\\documentclass[11pt,a4paper]{article}\n\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[italian]{babel}\n"
            "\\usepackage{amsmath,amssymb,amsfonts}\n\\usepackage{xcolor}\n\\usepackage[margin=2.5cm]{geometry}\n\\usepackage{parskip}\n"
            f"\\title{{{mathspeech.esc_tex(title)}}}\n\\date{{}}\n\\begin{{document}}\n\\maketitle\n\n" + "\n\n".join(body) + "\n\n\\end{document}\n")

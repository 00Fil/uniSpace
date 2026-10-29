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
# parole che Whisper sbaglia di piu' in una lezione di matematica: nel prompt iniziale lo "orientano".
# Whisper ne legge al massimo ~220 token; le parole del corso dell'utente vanno in fondo (la parte che resta).
PROMPTS = {
    "it": ("Lezione universitaria di matematica: algebra lineare, geometria e analisi. Matrice, determinante, autovalori, autovettori, "
           "autospazio, polinomio caratteristico, spazio vettoriale, sottospazio, combinazione lineare, base, dimensione, rango, nucleo, "
           "immagine, applicazione lineare, endomorfismo, isomorfismo, ortogonale, prodotto scalare, derivata, integrale, limite, serie, "
           "convergenza, successione, funzione continua, teorema, dimostrazione, ipotesi, tesi, per ogni, esiste, se e solo se. "
           "Si ha x al quadrato più 3 x meno 5 uguale a 0, f di x, una matrice n per n, lambda, epsilon, delta, R n."),
    "en": ("University mathematics lecture: linear algebra, geometry and calculus. Matrix, determinant, eigenvalues, eigenvectors, vector space, "
           "subspace, basis, dimension, rank, kernel, image, linear map, isomorphism, orthogonal, derivative, integral, limit, series, "
           "convergence, theorem, proof, for all, there exists, if and only if. We have x squared plus 3 x minus 5 equals 0, f of x, an n by n matrix."),
}


# errori tipici di Whisper sui termini del corso: (parole sentite) -> parola giusta
FIXES = [(tuple(k.split()), v) for k, v in (
    ("auto valori", "autovalori"), ("auto valore", "autovalore"), ("auto vettori", "autovettori"), ("auto vettore", "autovettore"),
    ("auto spazio", "autospazio"), ("auto spazi", "autospazi"), ("sotto spazio", "sottospazio"), ("sotto spazi", "sottospazi"),
    ("sotto insieme", "sottoinsieme"), ("sotto insiemi", "sottoinsiemi"), ("sotto matrice", "sottomatrice"), ("sotto successione", "sottosuccessione"),
    ("iper piano", "iperpiano"), ("iper piani", "iperpiani"), ("semi retta", "semiretta"), ("semi piano", "semipiano"),
    ("endo morfismo", "endomorfismo"), ("iso morfismo", "isomorfismo"), ("omo morfismo", "omomorfismo"), ("auto morfismo", "automorfismo"),
    ("contro immagine", "controimmagine"), ("co dominio", "codominio"), ("in iettiva", "iniettiva"), ("in iettività", "iniettività"),
    ("sur iettiva", "suriettiva"), ("bi iettiva", "biiettiva"), ("orto normale", "ortonormale"), ("orto normali", "ortonormali"),
    ("diagonalizza bile", "diagonalizzabile"), ("deriva bile", "derivabile"), ("integra bile", "integrabile"), ("infinite simo", "infinitesimo"),
    ("rusce capelli", "Rouché-Capelli"), ("ruscé capelli", "Rouché-Capelli"), ("rouche capelli", "Rouché-Capelli"), ("rouché capelli", "Rouché-Capelli"),
    ("gram smith", "Gram-Schmidt"), ("gram schmidt", "Gram-Schmidt"), ("gram-smith", "Gram-Schmidt"),
    ("de lopital", "de l'Hôpital"), ("de l'hopital", "de l'Hôpital"), ("lopital", "l'Hôpital"), ("l'opital", "l'Hôpital"), ("l'hopital", "l'Hôpital"),
    ("vaierstrass", "Weierstrass"), ("vaierstrasse", "Weierstrass"), ("weierstrasse", "Weierstrass"), ("cosci", "Cauchy"), ("coshi", "Cauchy"),
    ("cauchi", "Cauchy"), ("riman", "Riemann"), ("rieman", "Riemann"), ("laibniz", "Leibniz"), ("leibnitz", "Leibniz"), ("giordan", "Jordan"),
    ("gaus", "Gauss"), ("bine", "Binet"), ("laplas", "Laplace"), ("lagrangia", "Lagrange"), ("teilor", "Taylor"), ("mac laurin", "MacLaurin"),
    ("mclaurin", "MacLaurin"), ("silvester", "Sylvester"), ("ermite", "Hermite"), ("spam", "span"),
)]


def fix_terms(words):
    """Corregge sulle parole (tenendo i tempi) i termini che Whisper spezza o storpia."""
    out, i, n = [], 0, len(words)
    low = [re.sub(r"[^\w'\-]", "", w["w"].strip().lower()) for w in words]
    while i < n:
        hit = None
        for ph, rep in FIXES:
            k = len(ph)
            if tuple(low[i:i + k]) == ph and (hit is None or k > hit[0]):
                hit = (k, rep)
        if hit:
            k, rep = hit
            tail = re.search(r"[.,;:!?]+$", words[i + k - 1]["w"].strip())
            lead = " " if words[i]["w"].startswith(" ") else ""
            out.append({"w": lead + rep + (tail[0] if tail else ""), "s": words[i]["s"], "e": words[i + k - 1]["e"]})
            i += k
        else:
            out.append(words[i]); i += 1
    return out


# frasi che Whisper "inventa" sui silenzi: scartate nel recupero dei pezzi mancanti
JUNK = re.compile(r"amara\.org|sottotitol|grazie (a tutti )?per (la visione|l'ascolto|aver guardato)|iscrivet|thanks for watching|subtitles by", re.I)
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


# filtro passa-alto e volume uniforme, moderato: un livellamento piu' aggressivo alza anche il rumore
# e Whisper comincia a "sentire" parole che non ci sono
AUDIO_FILTER = "highpass=f=70,dynaudnorm=f=250:g=15:p=0.9:m=15"


def load_audio(ffmpeg, src):
    """Audio 16 kHz mono come array numpy, con filtro passa-alto e volume uniforme (il parlato resta piu' chiaro
    per il modello). Passa da ffmpeg e non da PyAV: nessun file temporaneo e nessuna dipendenza fragile."""
    import numpy as np
    r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
                        "-af", AUDIO_FILTER, "-f", "s16le", "-"], capture_output=True)
    if r.returncode != 0 or not r.stdout:
        raise RuntimeError("Audio non estraibile: " + r.stderr.decode("utf-8", "ignore").strip()[-200:])
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def to_units(words):
    return mathspeech.convert(fix_terms([{"w": w.word, "s": round(w.start, 3), "e": round(w.end, 3)} for w in words if w.word.strip()]))


def _opts(lang, vocab="", **kw):
    """Impostazioni collaudate: contesto della frase precedente attivo (coerenza del testo), niente hotwords
    (con liste di parole lunghe Whisper inserisce termini a caso), filtri anti-allucinazione di default."""
    prompt = PROMPTS.get(lang or "it", PROMPTS["it"])
    if vocab.strip():
        prompt += " Termini del corso: " + vocab.strip()[:300] + "."
    o = dict(language=lang, task="transcribe", beam_size=BEAM, best_of=5, patience=1.0,
             temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0], word_timestamps=True,
             condition_on_previous_text=True, prompt_reset_on_temperature=0.5, initial_prompt=prompt,
             no_speech_threshold=0.6, compression_ratio_threshold=2.4, log_prob_threshold=-1.0,
             hallucination_silence_threshold=2.0)
    o.update(kw)
    return o


def _vad_speech(clip, threshold=0.35):
    """Secondi di voce rilevati dal VAD (Silero) in un pezzo di audio."""
    try:
        from faster_whisper.vad import VadOptions, get_speech_timestamps
        ts = get_speech_timestamps(clip, VadOptions(threshold=threshold, min_speech_duration_ms=250, min_silence_duration_ms=300))
        return sum(t["end"] - t["start"] for t in ts) / 16000
    except Exception:
        return 0.0


def _speech_gaps(audio, segs, sr=16000, min_gap=1.5):
    """Tratti non coperti dalla trascrizione in cui il VAD sente comunque voce per almeno 0,8 s."""
    cover, t = [], 0.0
    for s in sorted(segs, key=lambda x: x["s"]):
        if s["s"] - t >= min_gap:
            cover.append((t, s["s"]))
        t = max(t, s["e"])
    total = len(audio) / sr
    if total - t >= min_gap:
        cover.append((t, total))
    out = []
    for a, b in cover:
        x = a
        while x < b - 0.5:                       # pezzi da max 25 s (una finestra di Whisper)
            y = min(b, x + 25.0)
            if _vad_speech(audio[int(x * sr):int(y * sr)]) >= 0.8:
                out.append((x, y))
            x = y
    return out


def run(ffmpeg, src, language, on_segment, on_progress, alive, duration, vocab=""):
    """Trascrive e chiama on_segment(seg) per ogni frase appena pronta. Restituisce (lingua, modello).
    Due passate: la prima normale; la seconda ritrascrive i tratti rimasti scoperti in cui il VAD sente voce,
    tenendo solo le frasi di cui il modello e' molto sicuro."""
    import numpy as np
    if not have_whisper():
        raise RuntimeError("faster-whisper non installato: esegui  pip install -U faster-whisper")
    on_progress(0.0, "Preparo l'audio...")
    audio = load_audio(ffmpeg, src)
    try:
        on_progress(0.0, "Carico il modello (la prima volta lo scarica)...")
        model = get_model()
        lang = None if language in (None, "", "auto") else language
        segs, info = model.transcribe(audio, **_opts(
            lang, vocab, vad_filter=True,
            # un po' piu' permissivo del default (0.5) per non scartare le frasi dette piano, ma senza esagerare
            vad_parameters={"threshold": 0.35, "min_speech_duration_ms": 200, "min_silence_duration_ms": 1000, "speech_pad_ms": 400}))
        lang = lang or info.language
        n, done = 0, []
        for s in segs:
            if not alive():
                raise RuntimeError("Interrotta: video eliminato")
            if JUNK.search(s.text or ""):
                continue
            words = s.words or []
            units = to_units(words) if words else [{"k": "w", "x": s.text.strip(), "s": round(s.start, 3), "e": round(s.end, 3)}]
            if units:
                seg = {"id": n, "s": round(s.start, 3), "e": round(s.end, 3), "u": units}
                on_segment(seg); done.append(seg)
                n += 1
            on_progress(min(0.9, 0.9 * s.end / max(duration, 1)), f"Trascrizione  {int(min(0.9, 0.9 * s.end / max(duration, 1)) * 100)}%")

        # ---- seconda passata: recupero dei pezzi persi
        gaps = _speech_gaps(audio, done)
        for k, (a, b) in enumerate(gaps):
            if not alive():
                raise RuntimeError("Interrotta: video eliminato")
            on_progress(0.9 + 0.09 * k / max(len(gaps), 1), f"Recupero le parti dette piano  {k + 1}/{len(gaps)}")
            i0, i1 = max(0, int((a - 0.4) * 16000)), min(len(audio), int((b + 0.4) * 16000))
            clip = audio[i0:i1]
            peak = float(np.abs(clip).max()) if len(clip) else 0
            if peak < 1e-4:
                continue
            clip = np.clip(clip * min(3.0, 0.9 / peak), -1, 1).astype(np.float32)
            off = i0 / 16000
            sub, _ = model.transcribe(clip, **_opts(lang, vocab, vad_filter=True, condition_on_previous_text=False,
                                                    vad_parameters={"threshold": 0.3, "speech_pad_ms": 300}, temperature=[0.0, 0.2]))
            for s in sub:
                # solo frasi di cui il modello e' davvero sicuro: meglio un pezzo in meno che parole inventate
                if JUNK.search(s.text or "") or s.avg_logprob < -0.7 or s.no_speech_prob > 0.4 or s.compression_ratio > 2.2:
                    continue
                ws = [w for w in (s.words or []) if w.probability >= 0.6 and a - 0.15 <= w.start + off and w.end + off <= b + 0.15]
                if len(ws) < 2:
                    continue
                for w in ws:
                    w.start, w.end = w.start + off, w.end + off
                units = to_units(ws)
                if units:
                    seg = {"id": n, "s": round(ws[0].start, 3), "e": round(ws[-1].end, 3), "u": units}
                    on_segment(seg); done.append(seg)
                    n += 1
        return lang, MODEL
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

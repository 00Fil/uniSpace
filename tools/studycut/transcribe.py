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
# prompt iniziale corto (solo lo stile: formule dette a voce, punteggiatura). Il vocabolario sta in HOTWORDS.
# Attenzione al budget: prompt + hotwords + testo devono stare nei 448 token di una finestra di Whisper.
PROMPTS = {
    "it": "Lezione universitaria di matematica. Si ha x al quadrato più 3 x meno 5 uguale a 0, f di x, una matrice n per n, lambda.",
    "en": "University mathematics lecture. We have x squared plus 3 x minus 5 equals 0, f of x, an n by n matrix, lambda.",
}
# vocabolario ripetuto in OGNI finestra da 30 s (il prompt iniziale vale solo per la prima). Budget:
# ~110 token (vedi PROMPTS): prima le parole del corso scritte dall'utente nelle impostazioni, poi queste, in ordine di importanza
HOTWORDS = {
    "it": ("autovalori autovettori autospazio matrice determinante rango nucleo immagine sottospazio isomorfismo endomorfismo "
           "diagonalizzabile polinomio caratteristico molteplicità algebrica geometrica base canonica combinazione lineare "
           "linearmente indipendenti applicazione lineare trasposta inversa ortogonale ortonormale prodotto scalare prodotto vettoriale "
           "Gram-Schmidt Rouché-Capelli Cramer Binet Laplace Gauss Jordan spazio vettoriale iperpiano retta piano parametrico "
           "cartesiano coordinate omogenee conica quadrica ellisse iperbole parabola fascio derivata integrale limite serie successione "
           "convergenza continuità derivabile primitiva Taylor Cauchy Lagrange Rolle Weierstrass Bolzano de l'Hôpital Riemann "
           "asintoto monotona estremo superiore infinitesimo o piccolo O grande epsilon delta lambda teorema dimostrazione lemma corollario"),
    "en": ("eigenvalues eigenvectors eigenspace matrix determinant rank kernel image subspace isomorphism diagonalizable characteristic "
           "polynomial basis linear combination linearly independent linear map transpose inverse orthogonal orthonormal inner product "
           "Gram-Schmidt Cramer Laplace Gauss Jordan hyperplane conic quadric derivative integral limit series sequence convergence "
           "continuity Taylor Cauchy Lagrange Rolle Weierstrass Riemann asymptote supremum infinitesimal big O epsilon delta lambda theorem proof lemma"),
}


def hotwords(lang, extra=""):
    """Parole del corso dell'utente + vocabolario di base, tagliate al limite di Whisper."""
    words = [w for w in re.split(r"[\s,;]+", (extra or "") + " " + HOTWORDS.get(lang or "it", HOTWORDS["it"])) if w]
    seen, out = set(), []
    for w in words:
        if w.lower() not in seen:
            seen.add(w.lower()); out.append(w)
    txt = ""
    for w in out:                         # ~3,7 caratteri per token: ~110 token, lascia spazio al testo
        if len(txt) + len(w) + 1 > 400:
            break
        txt += " " + w
    return txt.strip()


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


# passa-alto/basso sulla banda della voce, riduzione leggera del rumore e livellamento aggressivo:
# le frasi dette piano (o lontano dal microfono) arrivano al modello quasi forti come le altre
AUDIO_FILTER = ("highpass=f=60,lowpass=f=7800,afftdn=nr=10:nf=-30,"
                "dynaudnorm=f=150:g=9:m=40:p=0.95:r=0.9,alimiter=limit=0.95")


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
    o = dict(language=lang, task="transcribe", beam_size=BEAM, best_of=5, patience=1.2,
             temperature=[0.0, 0.2, 0.4, 0.6, 0.8], word_timestamps=True,
             # senza contesto della finestra precedente Whisper non "salta" pezzi di frase per inseguire il testo gia' scritto;
             # il vocabolario del corso resta grazie a hotwords, ripetuto in ogni finestra
             condition_on_previous_text=False, hotwords=hotwords(lang, vocab),
             no_speech_threshold=0.85, compression_ratio_threshold=2.4, log_prob_threshold=-1.0,
             repetition_penalty=1.05, no_repeat_ngram_size=0)
    o.update(kw)
    return o


def _speech_gaps(audio, segs, sr=16000, min_gap=0.8):
    """Intervalli non coperti dalla trascrizione in cui pero' c'e' voce (energia sopra il rumore di fondo)."""
    import numpy as np
    hop = int(sr * 0.03)
    n = len(audio) // hop
    if n < 10:
        return []
    rms = np.sqrt((audio[: n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
    floor = float(np.percentile(rms, 15))
    thr = max(floor * 2.5, 0.004)
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
        fr = rms[int(a / 0.03): int(b / 0.03)]
        if len(fr) and (fr > thr).mean() > 0.12:            # almeno il 12% del tratto ha voce
            # spezza i buchi lunghi in pezzi da max 25 s (una finestra di Whisper)
            x = a
            while x < b - 0.3:
                out.append((x, min(b, x + 25.0)))
                x += 25.0
    return out


def run(ffmpeg, src, language, on_segment, on_progress, alive, duration, vocab=""):
    """Trascrive e chiama on_segment(seg) per ogni frase appena pronta. Restituisce (lingua, modello).
    Due passate: la prima con il rilevatore di voce (VAD) tarato largo; la seconda ritrascrive, senza VAD e con
    volume alzato, ogni tratto rimasto scoperto in cui c'e' comunque voce (frasi dette piano, code di frase)."""
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
            lang, vocab, initial_prompt=PROMPTS.get(lang or "it", PROMPTS["it"]), vad_filter=True,
            # soglia bassa e margini ampi: meglio passare al modello un po' di silenzio che perdere una frase sussurrata
            vad_parameters={"threshold": 0.2, "neg_threshold": 0.1, "min_speech_duration_ms": 0,
                            "min_silence_duration_ms": 1500, "speech_pad_ms": 800}))
        lang = lang or info.language
        n, done = 0, []
        for s in segs:
            if not alive():
                raise RuntimeError("Interrotta: video eliminato")
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
            clip = np.clip(clip * min(8.0, 0.9 / peak), -1, 1).astype(np.float32)
            off = i0 / 16000
            sub, _ = model.transcribe(clip, **_opts(lang, vocab, vad_filter=False, temperature=[0.0, 0.2, 0.4], no_speech_threshold=0.9))
            for s in sub:
                if JUNK.search(s.text or "") or s.avg_logprob < -1.3:
                    continue
                # tieni solo le parole sicure e che cadono davvero nel buco (non doppioni delle frasi gia' presenti)
                ws = [w for w in (s.words or []) if w.probability >= 0.25 and a - 0.15 <= w.start + off and w.end + off <= b + 0.15]
                if not ws:
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

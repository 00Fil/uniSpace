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
    ("mclaurin", "MacLaurin"),
    ("vu doppia", "w"), ("vu doppio", "w"), ("v doppia", "w"), ("v doppio", "w"), ("u doppia", "w"), ("u doppio", "w"),
    ("doppia vu", "w"), ("doppio vu", "w"), ("doppia v", "w"), ("doppia u", "w"), ("silvester", "Sylvester"), ("ermite", "Hermite"), ("spam", "span"),
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
            out.append({"w": lead + rep + (tail[0] if tail else ""), "s": words[i]["s"], "e": words[i + k - 1]["e"]})   # termine del corso: sicuro
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


def join_elisions(words):
    """Whisper spezza le elisioni in due parole ("Nell" + "'esempio", "all" + "'ora"): le riunisce tenendo i tempi."""
    out = []
    for w in words:
        t = w["w"].strip()
        if out and (t[:1] in "'’" or out[-1]["w"].rstrip()[-1:] in "'’") and re.match(r"^['’]?\w", t):
            q = [x["q"] for x in (out[-1], w) if x.get("q") is not None]
            out[-1] = {"w": out[-1]["w"].rstrip() + t, "s": out[-1]["s"], "e": w["e"], **({"q": min(q)} if q else {})}
        else:
            out.append(w)
    return out


UNSURE = float(os.environ.get("STUDYCUT_UNSURE", "0.5"))     # sotto questa probabilita' una parola e' "incerta"


def _word(w, off=0.0):
    d = {"w": w.word, "s": round(w.start + off, 3), "e": round(w.end + off, 3)}
    if w.probability < UNSURE:
        d["q"] = round(float(w.probability), 2)
    return d


def drop_bad_tex(segs):
    """Formule che KaTeX non compone (regole a voce sbagliate): tornano parole normali, come erano state dette."""
    import refine
    ref = [(g, k) for g in segs for k, u in enumerate(g["u"]) if u["k"] == "m"]
    res = refine.check_tex([[g["u"][k]["x"], bool(g["u"][k].get("d"))] for g, k in ref])
    bad = 0
    for (g, k), err in reversed(list(zip(ref, res))):
        if err:
            u = g["u"][k]
            ws = (u.get("src") or u["x"]).split() or [u["x"]]
            d = (u["e"] - u["s"]) / len(ws)
            g["u"][k:k + 1] = [{"k": "w", "x": w + (u.get("p", "") if j == len(ws) - 1 else ""), "s": round(u["s"] + j * d, 3),
                                "e": round(u["s"] + (j + 1) * d, 3)} for j, w in enumerate(ws)]
            bad += 1
    return bad


def to_units(words, off=0.0):
    return mathspeech.convert(fix_terms(join_elisions([_word(w, off) for w in words if w.word.strip()])))


def _recheck(model, audio, segs, lang, vocab, seen, alive, on_progress=lambda k, n: None, sr=16000):
    """Seconda opinione sulle parole incerte: intorno a ogni gruppo di parole incerte l'audio (con 2 s di margine)
    viene ritrascritto da solo, con le frasi precedenti come contesto e senza il testo "trascinato" dalla passata
    lunga, che e' la causa tipica delle parole inventate ("li sommiamo" -> "li scioppiamo"). Le parole nuove che
    cadono nel tempo delle parole incerte le sostituiscono solo se sono nettamente piu' sicure.
    Le frasi si aggiornano sul posto (sono gli stessi oggetti gia' salvati)."""
    import numpy as np
    jobs = []
    for gi, g in enumerate(segs):
        bad = [k for k, u in enumerate(g["u"]) if u["k"] == "w" and u.get("q") is not None and u["q"] < UNSURE * 0.8]
        for k in bad:                                  # gruppi di parole incerte vicine (al massimo 2 parole in mezzo)
            if jobs and jobs[-1][0] == gi and k - jobs[-1][2] <= 3:
                jobs[-1][2] = k
            else:
                jobs.append([gi, k, k])
    jobs = jobs[:int(os.environ.get("STUDYCUT_RECHECK_MAX", "400"))]
    fixed = 0
    for n, (gi, k0, k1) in enumerate(reversed(jobs)):  # dal fondo: le sostituzioni non spostano gli indici dei gruppi prima
        if not alive():
            raise RuntimeError("Interrotta: video eliminato")
        on_progress(n, len(jobs))
        g = segs[gi]
        old = g["u"][k0:k1 + 1]
        a, b = old[0]["s"], old[-1]["e"]
        i0, i1 = max(0, int((a - 2.5) * sr)), min(len(audio), int((b + 2.5) * sr))
        if i1 - i0 < sr:
            continue
        ctx = " ".join(seg_text(x) for x in segs[max(0, gi - 2):gi]).replace("$", "")[-300:]
        try:
            sub, _ = model.transcribe(np.ascontiguousarray(audio[i0:i1]), **_opts(
                lang, vocab, seen, vad_filter=False, condition_on_previous_text=False, temperature=[0.0],
                beam_size=max(BEAM, 8), prompt_ctx=ctx))
            words = [w for x in sub for w in (x.words or [])]
        except Exception:
            continue
        off = i0 / sr
        words = [w for w in words if w.word.strip()]
        if not words or JUNK.search(" ".join(w.word for w in words)):
            continue
        # decisione parola per parola: ogni parola incerta si confronta con le parole nuove che cadono nel suo tempo
        out, changed = [], False
        nrm = lambda x: re.sub(r"\W", "", x.lower())
        for j, u in enumerate(old):
            if u["k"] != "w" or u.get("q") is None or u["q"] >= UNSURE * 0.8:
                out.append(u); continue
            hit = [w for w in words if u["s"] - 0.08 <= (w.start + w.end) / 2 + off <= u["e"] + 0.08]
            # i tempi delle due letture non coincidono al millisecondo: le parole vicine gia' presenti non si ripetono
            prev = g["u"][k0 + j - 1] if k0 + j > 0 else None
            nxt = g["u"][k0 + j + 1] if k0 + j + 1 < len(g["u"]) else None
            while hit and prev and nrm(hit[0].word) == nrm(prev["x"]) and nrm(hit[0].word) != nrm(u["x"]):
                hit = hit[1:]
            while hit and nxt and nrm(hit[-1].word) == nrm(nxt["x"]) and nrm(hit[-1].word) != nrm(u["x"]):
                hit = hit[:-1]
            if not hit or len(hit) > 3:
                out.append(u); continue
            p_new = min(w.probability for w in hit)
            same = "".join(nrm(w.word) for w in hit) == nrm(u["x"])
            if os.environ.get("RDEBUG"):
                print("RC", u["x"], u["q"], [w.word for w in hit], round(p_new, 2))
            if same or p_new < max(u["q"] + 0.3, UNSURE):
                out.append(u); continue
            rep = to_units(hit, off)
            tail = re.search(r"[.,;:!?]+$", u["x"])         # la punteggiatura della parola originale resta
            if rep and tail and rep[-1]["k"] == "w" and not re.search(r"[.,;:!?]$", rep[-1]["x"]):
                rep[-1]["x"] += tail[0]
            out.extend(rep); changed = True
        if changed:
            g["u"][k0:k1 + 1] = out
            fixed += 1
    return fixed


def _opts(lang, vocab="", seen=(), **kw):
    """Impostazioni collaudate: contesto della frase precedente attivo (coerenza del testo), niente hotwords
    (con liste di parole lunghe Whisper inserisce termini a caso), filtri anti-allucinazione di default.
    seen: parole lette sui fotogrammi della lezione (lavagna, slide). Whisper tiene solo la coda del prompt,
    quindi l'ordine e': prompt del corso, parole viste, parole dello studente (le piu' importanti in fondo)."""
    prompt = PROMPTS.get(lang or "it", PROMPTS["it"])
    ctx = kw.pop("prompt_ctx", "")
    if seen:
        prompt += " Alla lavagna: " + ", ".join(list(seen)[:30]) + "."
    if vocab.strip():
        prompt += " Termini del corso: " + vocab.strip()[:300] + "."
    if ctx:                                   # frase appena detta: la coda del prompt e' quella che Whisper legge di piu'
        prompt += " " + ctx
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


FRAMES_ON = os.environ.get("STUDYCUT_FRAMES", "1") != "0"


def run(ffmpeg, src, language, on_segment, on_progress, alive, duration, vocab="", work_dir=None, has_video=True, on_replace=None):
    """Trascrive e chiama on_segment(seg) per ogni frase appena pronta. Restituisce (lingua, modello, info).
    1. fotogrammi chiave del video + testo letto sulla lavagna/slide (visual.py): le parole viste orientano Whisper;
    2. Whisper in due passate: la prima normale, la seconda ritrascrive i tratti rimasti scoperti in cui il VAD
       sente voce, tenendo solo le frasi di cui il modello e' molto sicuro;
    3. se e' configurato un modello multimodale (refine.py), ogni tratto viene corretto confrontando audio e
       fotogrammi e le formule diventano LaTeX controllato con KaTeX; on_replace(frasi, info) riceve il risultato."""
    import numpy as np
    if not have_whisper():
        raise RuntimeError("faster-whisper non installato: esegui  pip install -U faster-whisper")
    info, frames, frames_dir = {"frames": 0}, [], (Path(work_dir) / "frames") if work_dir else None
    W0, W1 = 0.0, 0.72                                  # parte della barra per Whisper
    if has_video and FRAMES_ON and frames_dir is not None:
        import visual
        on_progress(0.0, "Leggo la lavagna e le slide...")
        try:
            frames = visual.extract(ffmpeg, src, frames_dir, duration, alive,
                                    lambda p: on_progress(0.06 * p, f"Leggo la lavagna e le slide  {int(p * 100)}%"))
            info["frames"] = len(frames)
        except Exception as e:
            if not alive():
                raise RuntimeError("Interrotta: video eliminato")
            info["frames_error"] = str(e)[-200:]
        W0 = 0.06
    import refine
    if not refine.available():
        W1 = 0.97
    seen = []
    if frames:
        import visual
        seen = visual.vocab(frames)
    on_progress(W0, "Preparo l'audio...")
    audio = load_audio(ffmpeg, src)
    try:
        on_progress(0.0, "Carico il modello (la prima volta lo scarica)...")
        model = get_model()
        lang = None if language in (None, "", "auto") else language
        segs, winfo = model.transcribe(audio, **_opts(
            lang, vocab, seen, vad_filter=True,
            # un po' piu' permissivo del default (0.5) per non scartare le frasi dette piano, ma senza esagerare
            vad_parameters={"threshold": 0.35, "min_speech_duration_ms": 200, "min_silence_duration_ms": 1000, "speech_pad_ms": 400}))
        lang = lang or winfo.language
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
            f = min(1.0, s.end / max(duration, 1))
            on_progress(W0 + (W1 - W0) * 0.93 * f, f"Trascrizione dell'audio  {int(f * 100)}%")

        # ---- ricontrollo delle parole incerte (seconda opinione su ogni tratto dubbio)
        info["rechecked"] = _recheck(model, audio, done, lang, vocab, seen, alive,
                                     lambda k, n: on_progress(W0 + (W1 - W0) * 0.93, f"Ricontrollo le parole incerte  {k + 1}/{n}"))

        # ---- seconda passata: recupero dei pezzi persi
        gaps = _speech_gaps(audio, done)
        for k, (a, b) in enumerate(gaps):
            if not alive():
                raise RuntimeError("Interrotta: video eliminato")
            on_progress(W0 + (W1 - W0) * (0.93 + 0.07 * k / max(len(gaps), 1)), f"Recupero le parti dette piano  {k + 1}/{len(gaps)}")
            i0, i1 = max(0, int((a - 0.4) * 16000)), min(len(audio), int((b + 0.4) * 16000))
            clip = audio[i0:i1]
            peak = float(np.abs(clip).max()) if len(clip) else 0
            if peak < 1e-4:
                continue
            clip = np.clip(clip * min(3.0, 0.9 / peak), -1, 1).astype(np.float32)
            off = i0 / 16000
            sub, _ = model.transcribe(clip, **_opts(lang, vocab, seen, vad_filter=True, condition_on_previous_text=False,
                                                    vad_parameters={"threshold": 0.3, "speech_pad_ms": 300}, temperature=[0.0, 0.2]))
            for s in sub:
                # solo frasi di cui il modello e' davvero sicuro: meglio un pezzo in meno che parole inventate
                if JUNK.search(s.text or "") or s.avg_logprob < -0.7 or s.no_speech_prob > 0.4 or s.compression_ratio > 2.2:
                    continue
                ws = [w for w in (s.words or []) if w.probability >= 0.6 and a - 0.15 <= w.start + off and w.end + off <= b + 0.15]
                if len(ws) < 2:
                    continue
                units = to_units(ws, off)
                if units:
                    seg = {"id": n, "s": round(ws[0].start + off, 3), "e": round(ws[-1].end + off, 3), "u": units}
                    on_segment(seg); done.append(seg)
                    n += 1
    finally:
        del audio

    # ---- terza fase: correzione incrociando audio e fotogrammi
    done.sort(key=lambda g: g["s"])
    for k, g in enumerate(done):
        g["id"] = k
    info["bad_tex"] = drop_bad_tex(done)
    if refine.available() and done and on_replace:
        on_progress(W1, "Correggo con audio e video...")
        try:
            fixed, rinfo = refine.run(done, frames, frames_dir, vocab, lang,
                                      lambda p, msg: on_progress(W1 + (0.99 - W1) * p, msg), alive)
            info["refine"] = rinfo
            on_replace(fixed, info)
        except Exception as e:
            if not alive():
                raise RuntimeError("Interrotta: video eliminato")
            info["refine_error"] = str(e)[-300:]
    return lang, MODEL, info


# ---------------------------------------------------------------- testo <-> unita' (modifica a mano ed esportazione)
def seg_text(seg):
    """Frase come testo con le formule fra $...$."""
    import refine
    return refine.seg_text(seg)


def parse_text(text, s, e, orig=None):
    """Testo con $...$ / $$...$$ -> unita'. Con orig (le unita' di prima) le parole rimaste uguali tengono i loro
    tempi; altrimenti i tempi si ripartiscono in proporzione alla lunghezza."""
    import refine
    if orig:
        return refine.align(orig, refine.fix_tex_text(text), s, e)
    toks = refine.tokens(refine.fix_tex_text(text))
    if not toks:
        return []
    w = [max(1, len(x[1])) for x in toks]
    tot, t, units = float(sum(w)), s, []
    for (k, x, p, d), wi in zip(toks, w):
        dt = (e - s) * wi / tot
        u = {"k": k, "x": x, "s": round(t, 3), "e": round(t + dt, 3)}
        if k == "m":
            u["p"] = p
            if d:
                u["d"] = 1
        units.append(u)
        t += dt
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
            if u["k"] == "m" and u.get("d"):
                txt.append(f"\\[{u['x']}\\]{mathspeech.esc_tex(u.get('p', ''))}")
            else:
                txt.append(f"${u['x']}${mathspeech.esc_tex(u.get('p', ''))}" if u["k"] == "m" else mathspeech.esc_tex(u["x"]))
        stamp_t = f"\\textcolor{{gray}}{{\\scriptsize[{stamp(s['s'])}]}}~" if not para else ""
        para.append(stamp_t + " ".join(txt))
        last = s["e"]
    if para:
        body.append(" ".join(para))
    return ("\\documentclass[11pt,a4paper]{article}\n\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[italian]{babel}\n"
            "\\usepackage{amsmath,amssymb,amsfonts}\n\\usepackage{xcolor}\n\\usepackage[margin=2.5cm]{geometry}\n\\usepackage{parskip}\n"
            f"\\title{{{mathspeech.esc_tex(title)}}}\n\\date{{}}\n\\begin{{document}}\n\\maketitle\n\n" + "\n\n".join(body) + "\n\n\\end{document}\n")

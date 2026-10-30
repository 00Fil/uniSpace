"""Correzione della trascrizione incrociando audio e video con un modello multimodale.

Per ogni tratto di lezione (~2-3 minuti) il modello riceve:
  - i fotogrammi chiave visibili in quel tratto (lavagna, slide), come immagini;
  - il testo letto sui fotogrammi (OCR, solo come aiuto);
  - la trascrizione di Whisper frase per frase, con il contesto prima e dopo;
e restituisce le stesse frasi corrette: parole sentite male sistemate guardando la lavagna, punteggiatura,
formule dette a voce scritte in LaTeX con la notazione della lavagna.
Ogni formula viene poi controllata con KaTeX (latexcheck.mjs); quelle che non si compongono tornano al modello
una volta con l'errore, e se restano sbagliate la frase torna alla versione di Whisper.
I tempi delle parole restano quelli dell'audio: il testo corretto viene allineato parola per parola all'originale.

Provider (variabili d'ambiente):
  ANTHROPIC_API_KEY                   -> Claude (consigliato; STUDYCUT_LLM_MODEL, default claude-sonnet-5-5)
  STUDYCUT_LLM_URL [+ STUDYCUT_LLM_KEY] -> qualunque API compatibile OpenAI con immagini (es. Ollama + qwen2.5vl)
  STUDYCUT_LLM=off                    -> disattiva la correzione
"""
import base64, difflib, json, os, re, shutil, subprocess, threading, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = Path(__file__).resolve().parent
MODE = os.environ.get("STUDYCUT_LLM", "auto").lower()
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OAI_URL = os.environ.get("STUDYCUT_LLM_URL", "").rstrip("/")
OAI_KEY = os.environ.get("STUDYCUT_LLM_KEY", "")
MODEL = os.environ.get("STUDYCUT_LLM_MODEL") or ("claude-sonnet-5-5" if API_KEY else "qwen2.5vl")
CHUNK_S = float(os.environ.get("STUDYCUT_LLM_CHUNK", "150"))     # secondi di lezione per richiesta
IMAGES = int(os.environ.get("STUDYCUT_LLM_IMAGES", "4"))          # fotogrammi per richiesta
WORKERS = int(os.environ.get("STUDYCUT_LLM_PARALLEL", "3"))
TIMEOUT = 240


def provider():
    if MODE in ("off", "0", "no", "false"):
        return None
    if API_KEY and MODE in ("auto", "anthropic", "claude"):
        return "anthropic"
    if OAI_URL and MODE in ("auto", "openai"):
        return "openai"
    return None


def available():
    return provider() is not None


SYSTEM = """Sei un revisore esperto di trascrizioni di lezioni universitarie (matematica, fisica, ingegneria, informatica).
Ricevi un tratto di lezione: i fotogrammi visibili in quel momento (lavagna, slide, tablet), il testo letto sui fotogrammi con un OCR (puo' contenere errori) e la trascrizione automatica dell'audio, frase per frase, con id e tempi.
Il tuo compito: restituire ogni frase corretta, incrociando cio' che si sente con cio' che si vede.

Regole:
1. Fedelta' totale: tutto cio' che il docente dice resta, nello stesso ordine. Non riassumere, non aggiungere spiegazioni, non completare ragionamenti con parti non dette. Togli solo le esitazioni pure (ehm, mmh) e le ripetizioni identiche di una falsa partenza.
2. Parole sentite male: correggile con il contesto e con i fotogrammi. Termini tecnici, nomi propri (teoremi, matematici), sigle, simboli e numeri scritti sulla lavagna hanno la precedenza su come li ha capiti l'audio.
3. Grammatica, punteggiatura e maiuscole corrette, ma mantieni il parlato del docente: non trasformarlo in un testo scritto formale e non cambiare le sue parole se sono gia' giuste.
4. Matematica: ogni espressione detta a voce va scritta in LaTeX fra $...$ (in linea), con la stessa notazione dei fotogrammi (nomi delle variabili, pedici, apici, insiemi, vettori). Equazioni centrali, sistemi e matrici dettati per intero vanno fra $$...$$. Se una formula e' gia' in LaTeX ma sbagliata, correggila.
5. Solo LaTeX che KaTeX compone: usa aligned, pmatrix, bmatrix, vmatrix, cases, \\text{}, \\mathbb, \\mathbf, \\operatorname. Niente \\begin{align}, \\label, \\newcommand, pacchetti, $ annidati. Ogni $ aperto va chiuso nella stessa frase.
6. Non inventare formule: se il docente indica la lavagna ("questa", "qui sopra") senza dettare la formula, trascrivi solo cio' che dice.
7. Stessi id, stesso numero di frasi: un elemento per ogni id ricevuto, nessuno in piu'. Una parola spezzata fra due frasi si ripara nella prima.
8. Frasi che sono rumore o allucinazioni dell'audio (es. "Sottotitoli a cura di...", parole senza senso su un silenzio): testo vuoto.
9. Scrivi nella lingua della lezione."""

TOOL = {
    "name": "consegna_trascrizione",
    "description": "Consegna le frasi corrette del tratto di lezione, una per id.",
    "input_schema": {
        "type": "object",
        "properties": {"segments": {"type": "array", "items": {
            "type": "object", "properties": {"id": {"type": "integer"}, "text": {"type": "string"}}, "required": ["id", "text"]}}},
        "required": ["segments"],
    },
}


# ---------------------------------------------------------------- chiamate al modello
def _post(url, body, headers):
    data = json.dumps(body).encode("utf-8")
    last = None
    for attempt in range(5):
        req = urllib.request.Request(url, data=data, headers={"content-type": "application/json", **headers}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "ignore")[:300]
            last = RuntimeError(f"{e.code}: {msg}")
            if e.code not in (408, 409, 429, 500, 502, 503, 504, 529):
                raise last
            wait = float(e.headers.get("retry-after") or 0) or 4 * 2 ** attempt
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last, wait = RuntimeError(str(e)), 4 * 2 ** attempt
        time.sleep(min(wait, 60))
    raise last


def _ask(images, text, usage):
    """images: [(didascalia, bytes jpeg)]. Restituisce {id: testo}."""
    p = provider()
    if p == "anthropic":
        content = []
        for cap, b in images:
            content.append({"type": "text", "text": cap})
            content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(b).decode()}})
        content.append({"type": "text", "text": text})
        r = _post("https://api.anthropic.com/v1/messages", {
            "model": MODEL, "max_tokens": 8000, "temperature": 0, "system": SYSTEM, "tools": [TOOL],
            "tool_choice": {"type": "tool", "name": TOOL["name"]}, "messages": [{"role": "user", "content": content}],
        }, {"x-api-key": API_KEY, "anthropic-version": "2023-06-01"})
        u = r.get("usage") or {}
        usage["input_tokens"] += u.get("input_tokens", 0); usage["output_tokens"] += u.get("output_tokens", 0)
        data = next((c.get("input") for c in r.get("content", []) if c.get("type") == "tool_use"), None)
    else:
        content = []
        for cap, b in images:
            content.append({"type": "text", "text": cap})
            content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b).decode()}})
        content.append({"type": "text", "text": text + '\n\nRispondi solo con JSON: {"segments": [{"id": 0, "text": "..."}]}'})
        r = _post(OAI_URL + "/chat/completions", {
            "model": MODEL, "temperature": 0, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": content}],
        }, {"authorization": "Bearer " + OAI_KEY} if OAI_KEY else {})
        u = r.get("usage") or {}
        usage["input_tokens"] += u.get("prompt_tokens", 0); usage["output_tokens"] += u.get("completion_tokens", 0)
        raw = (r.get("choices") or [{}])[0].get("message", {}).get("content") or ""
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m[0]) if m else None
    if not isinstance(data, dict) or not isinstance(data.get("segments"), list):
        raise RuntimeError("Risposta del modello non valida")
    out = {}
    for s in data["segments"]:
        try:
            out[int(s["id"])] = str(s.get("text") or "").strip()
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- testo <-> unita', allineamento dei tempi
TOK = re.compile(r"\$\$(.+?)\$\$([.,;:!?]*)|\$([^$]+?)\$([.,;:!?]*)|(\S+)", re.S)


def tokens(text):
    """Testo con $...$ e $$...$$ -> [(tipo, contenuto, punteggiatura, display)]."""
    out = []
    for m in TOK.finditer(text.replace("\n", " ")):
        if m.group(1) is not None:
            out.append(("m", m.group(1).strip(), m.group(2) or "", True))
        elif m.group(3) is not None:
            out.append(("m", m.group(3).strip(), m.group(4) or "", False))
        elif m.group(5).strip("$"):
            out.append(("w", m.group(5).replace("$", ""), "", False))
    return [t for t in out if t[1]]


def _norm(k, x):
    return "§m" if k == "m" else re.sub(r"[^\w]", "", x.lower())


def align(orig, text, s, e):
    """Unita' del testo corretto con i tempi presi dalle parole uguali dell'originale; il resto si distribuisce
    nel tempo delle parole che sostituisce (o fra le parole vicine)."""
    new = tokens(text)
    if not new:
        return []
    a = [_norm(u["k"], u["x"]) for u in orig]
    b = [_norm(k, x) for k, x, _, _ in new]
    times = [None] * len(new)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == "equal":
            for k in range(b2 - b1):
                times[b1 + k] = (orig[a1 + k]["s"], orig[a1 + k]["e"])
        elif b2 > b1:
            t0 = orig[a1]["s"] if a2 > a1 else (orig[a1 - 1]["e"] if a1 > 0 else s)
            t1 = orig[a2 - 1]["e"] if a2 > a1 else (orig[a1]["s"] if a1 < len(orig) else e)
            t1 = max(t0, t1)
            w = [max(1, len(new[j][1]) if new[j][0] == "w" else len(new[j][1]) // 2) for j in range(b1, b2)]
            tot, t = float(sum(w)), t0
            for j, wj in zip(range(b1, b2), w):
                d = (t1 - t0) * wj / tot
                times[j] = (t, t + d); t += d
    units = []
    for (k, x, p, disp), (t0, t1) in zip(new, times):
        u = {"k": k, "x": x, "s": round(min(max(t0, s), e), 3), "e": round(min(max(t1, s), e), 3)}
        if k == "m":
            u["p"] = p
            if disp:
                u["d"] = 1
        units.append(u)
    return units


def seg_text(seg):
    out = []
    for u in seg["u"]:
        if u["k"] == "m":
            out.append(("$$%s$$" if u.get("d") else "$%s$") % u["x"] + u.get("p", ""))
        else:
            out.append(u["x"])
    return " ".join(out)


# ---------------------------------------------------------------- controllo delle formule
FIXUPS = [(re.compile(r"\\begin\{(align|align\*|eqnarray\*?|equation\*?|gather\*?)\}"), r"\\begin{aligned}"),
          (re.compile(r"\\end\{(align|align\*|eqnarray\*?|equation\*?|gather\*?)\}"), r"\\end{aligned}"),
          (re.compile(r"\\label\{[^}]*\}"), ""), (re.compile(r"\\(nonumber|notag)\b"), "")]


def fix_tex(x):
    for rx, rep in FIXUPS:
        x = rx.sub(rep, x)
    return x.strip()


def _runtime():
    for exe, args in (("deno", ["run", "--quiet", "--allow-read"]), ("node", [])):
        p = shutil.which(exe)
        if p:
            return [p] + args + [str(BASE / "latexcheck.mjs")]
    return None


def check_tex(items):
    """items: [(latex, display)] -> [None | errore]. Senza Node/Deno non controlla (tutto valido)."""
    cmd = _runtime()
    if not items or not cmd:
        return [None] * len(items)
    try:
        r = subprocess.run(cmd, input=json.dumps(items), capture_output=True, text=True, timeout=60)
        out = json.loads(r.stdout)
        return out if len(out) == len(items) else [None] * len(items)
    except Exception:
        return [None] * len(items)


def _errors(texts):
    """{id: testo} -> {id: [errori]} per le frasi con formule che non compongono."""
    flat = []
    for i, t in texts.items():
        for k, x, _, d in tokens(t):
            if k == "m":
                flat.append((i, x, d))
        if t.count("$") % 2:
            flat.append((i, "$", False))
    res = check_tex([[x, d] for _, x, d in flat if x != "$"])
    bad, it = {}, iter(res)
    for i, x, d in flat:
        err = "dollaro non chiuso" if x == "$" else next(it)
        if err:
            bad.setdefault(i, []).append(f"{x} -> {err}")
    return bad


# ---------------------------------------------------------------- tratti di lezione
def _chunks(segs):
    out, cur = [], []
    for g in segs:
        if cur and (g["e"] - cur[0]["s"] > CHUNK_S or len(cur) >= 40):
            out.append(cur); cur = []
        cur.append(g)
    if cur:
        out.append(cur)
    return out


def _mmss(t):
    t = int(t)
    return f"{t // 60}:{t % 60:02d}" if t < 3600 else f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}"


def _prompt(chunk, before, after, frames, vocab, lang):
    parts = []
    if vocab:
        parts.append("Termini del corso indicati dallo studente: " + vocab[:600])
    if frames:
        ocr = [f"[{_mmss(f['t0'])}-{_mmss(f['t1'])}] " + re.sub(r"\s*\n\s*", " | ", f.get("text") or "")[:500] for f in frames if f.get("text")]
        if ocr:
            parts.append("Testo letto sui fotogrammi (OCR, puo' avere errori):\n" + "\n".join(ocr))
    else:
        parts.append("Nessun fotogramma per questo tratto: correggi solo con il contesto.")
    if before:
        parts.append("Contesto precedente (non va restituito):\n" + "\n".join(seg_text(g) for g in before))
    parts.append("Trascrizione da correggere (" + ("italiano" if lang == "it" else lang or "lingua della lezione") + "):\n" +
                 "\n".join(f"[{g['id']}] ({_mmss(g['s'])}) {seg_text(g)}" for g in chunk))
    if after:
        parts.append("Contesto successivo (non va restituito):\n" + "\n".join(seg_text(g) for g in after))
    parts.append(f"Restituisci esattamente gli id da {chunk[0]['id']} a {chunk[-1]['id']}.")
    return "\n\n".join(parts)


def _do_chunk(ci, chunks, frames, frames_dir, vocab, lang, usage):
    chunk = chunks[ci]
    before = chunks[ci - 1][-3:] if ci > 0 else []
    after = chunks[ci + 1][:2] if ci + 1 < len(chunks) else []
    vis = []
    if frames:
        import visual
        vis = visual.in_range(frames, chunk[0]["s"] - 5, chunk[-1]["e"] + 2, IMAGES)
    images = []
    for f in vis:
        try:
            images.append((f"Fotogramma a {_mmss(f['t'])} (si vede da {_mmss(f['t0'])} a {_mmss(f['t1'])}):", (Path(frames_dir) / f["file"]).read_bytes()))
        except Exception:
            pass
    text = _prompt(chunk, before, after, vis, vocab, lang)
    ids = {g["id"] for g in chunk}
    got = {i: fix_tex_text(t) for i, t in _ask(images, text, usage).items() if i in ids}
    bad = _errors(got)
    if bad:  # una seconda possibilita' con gli errori di KaTeX, poi si torna a Whisper
        note = "\n\nQueste formule non si compongono con KaTeX, correggile (stesse regole):\n" + "\n".join(
            f"[{i}] " + "; ".join(v) for i, v in bad.items())
        try:
            again = _ask(images, text + note, usage)
            for i in bad:
                if i in again:
                    got[i] = fix_tex_text(again[i])
        except Exception:
            pass
        for i in _errors({i: got[i] for i in bad}):
            got.pop(i, None)
    return got


def fix_tex_text(t):
    return TOK.sub(lambda m: (f"$${fix_tex(m.group(1))}$${m.group(2) or ''}" if m.group(1) is not None else
                              f"${fix_tex(m.group(3))}${m.group(4) or ''}" if m.group(3) is not None else m.group(0)), t)


def run(segs, frames, frames_dir, vocab="", lang="it", on_progress=lambda p, msg: None, alive=lambda: True):
    """Corregge le frasi. Restituisce (nuove_frasi, info). Le frasi che il modello non restituisce restano come prima."""
    usage = {"input_tokens": 0, "output_tokens": 0}
    chunks = _chunks(segs)
    results, done, lock, errors = {}, [0], threading.Lock(), []

    def work(ci):
        if not alive():
            return
        try:
            r = _do_chunk(ci, chunks, frames, frames_dir, vocab, lang, usage)
            with lock:
                results.update(r)
        except Exception as e:
            with lock:
                errors.append(str(e))
        with lock:
            done[0] += 1
            on_progress(done[0] / len(chunks), f"Correggo con audio e video  {done[0]}/{len(chunks)}")

    with ThreadPoolExecutor(max_workers=max(1, WORKERS)) as ex:
        list(ex.map(work, range(len(chunks))))
    if not alive():
        raise RuntimeError("Interrotta: video eliminato")
    if errors and not results:
        raise RuntimeError("Correzione non riuscita: " + errors[0][-200:])
    out, changed = [], 0
    for g in segs:
        t = results.get(g["id"])
        if t is None:
            out.append(g); continue
        nw = len([u for u in g["u"] if u["k"] == "w"])
        units = align(g["u"], t, g["s"], g["e"]) if t else []
        # protezione contro i riassunti: una frase lunga non puo' sparire o dimezzarsi
        if nw >= 10 and len(tokens(t)) < 0.5 * nw:
            out.append(g); continue
        if not units:
            changed += 1
            continue                                   # frase di rumore: tolta
        if seg_text({"u": units}) != seg_text(g):
            changed += 1
        out.append({**g, "u": units})
    for k, g in enumerate(out):
        g["id"] = k
    info = {"provider": provider(), "model": MODEL, "chunks": len(chunks), "failed": len(errors), "changed": changed, **usage}
    return out, info

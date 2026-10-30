"""Fotogrammi chiave della lezione (lavagna, slide, tablet) e testo letto da ciascuno.

Serve alla trascrizione per incrociare cio' che si sente con cio' che si vede:
- le parole lette dai fotogrammi orientano Whisper (nomi propri, termini del corso, simboli);
- i fotogrammi stessi vanno al correttore (refine.py) che li confronta con il parlato e scrive le formule in LaTeX.

Come si scelgono i fotogrammi: il video si legge a 1 fotogramma al secondo in miniatura (grigio 128x72).
Una "scena" finisce quando l'immagine cambia molto (slide nuova, cambio inquadratura); di ogni scena si tiene
l'ultimo fotogramma stabile, cioe' la lavagna o la slide piu' completa. Le scene lunghe (si scrive alla lavagna)
vengono spezzate ogni MAX_SPAN secondi, cosi' nessun pezzo di lezione resta senza immagine."""
import json, os, re, shutil, subprocess
from pathlib import Path

W, H = 128, 72                     # miniatura per il confronto
SCENE = float(os.environ.get("STUDYCUT_FRAMES_SCENE", "0.025"))  # quota di pixel cambiati che apre una scena nuova
MAX_SPAN = float(os.environ.get("STUDYCUT_FRAMES_SPAN", "45"))    # secondi massimi coperti da un fotogramma
MAX_FRAMES = int(os.environ.get("STUDYCUT_FRAMES_MAX", "400"))
OUT_W = 1280                       # larghezza dei fotogrammi salvati (abbastanza per leggere una formula)

STOP = set("""a ad al alla alle allo agli ai anche che chi ci con cui da dal dalla dei del della delle dello degli di
e ed gli ha hanno il in la le lo ma ne nel nella nelle non o per perche piu poi quando se si sia sono su sul sulla
tra un una uno the and of to for with is are this that from by on at as be or an it its""".split())


def _tesseract():
    exe = shutil.which("tesseract")
    if not exe:
        return None, None
    try:
        out = subprocess.run([exe, "--list-langs"], capture_output=True, text=True, timeout=10).stdout
        langs = [l for l in ("ita", "eng") if re.search(rf"^{l}$", out, re.M)]
        return exe, "+".join(langs) or None
    except Exception:
        return None, None


def have_ocr():
    return _tesseract()[0] is not None


def _thumbs(ffmpeg, src, alive):
    """Miniature in grigio a 1 fps: lista di (tempo, array)."""
    import numpy as np
    p = subprocess.Popen([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-i", str(src), "-an", "-sn",
                          "-vf", f"fps=1,scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    n, out = W * H, []
    try:
        while True:
            b = p.stdout.read(n)
            if len(b) < n:
                break
            out.append((len(out) + 0.5, np.frombuffer(b, dtype=np.uint8).astype(np.float32) / 255.0))
            if len(out) % 300 == 0 and not alive():
                raise RuntimeError("Interrotta")
    finally:
        p.kill(); p.wait()
    return out


def pick_times(thumbs, duration):
    """Intervalli [t0, t1) con il tempo del fotogramma che li rappresenta."""
    import numpy as np
    if not thumbs:
        return []
    # quota di pixel cambiati davvero: con slide quasi bianche la differenza media non vede una formula nuova
    diff = lambda i: float((np.abs(thumbs[i][1] - thumbs[i - 1][1]) > 0.12).mean())
    cuts = [0]
    for i in range(1, len(thumbs)):
        if diff(i) > SCENE:
            cuts.append(i)
    cuts.append(len(thumbs))
    spans = []
    for a, b in zip(cuts, cuts[1:]):
        if b - a < 2 and spans:                     # transizione di un secondo: la unisco alla scena prima
            spans[-1] = (spans[-1][0], b)
            continue
        x = a
        while x < b:                                # scene lunghe: un fotogramma ogni MAX_SPAN secondi
            y = min(b, x + int(MAX_SPAN))
            if b - y < MAX_SPAN / 3:
                y = b
            spans.append((x, y)); x = y
    out = []
    for a, b in spans:
        # il fotogramma "piu' completo": l'ultimo dei secondi stabili prima della fine della scena
        k = b - 1
        while k > a and diff(k) > SCENE / 5:
            k -= 1
        pick = min(thumbs[k][0], max(0.0, duration - 0.3))
        out.append({"t0": float(a), "t1": float(min(b, duration)), "t": round(pick, 2)})
    if len(out) > MAX_FRAMES:                       # lezioni lunghissime: raggruppo gli intervalli vicini
        step, grouped = len(out) / MAX_FRAMES, []
        for i in range(MAX_FRAMES):
            g = out[int(i * step):max(int(i * step) + 1, int((i + 1) * step))]
            grouped.append({"t0": g[0]["t0"], "t1": g[-1]["t1"], "t": g[-1]["t"]})
        out = grouped
    return out


def _grab(ffmpeg, src, t, dst):
    r = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ss", f"{t:.2f}", "-i", str(src),
                        "-frames:v", "1", "-vf", f"scale='min({OUT_W},iw)':-2", "-q:v", "3", str(dst)], capture_output=True)
    return r.returncode == 0 and dst.exists()


def _ocr(exe, langs, img):
    cmd = [exe, str(img), "-", "--psm", "3"] + (["-l", langs] if langs else [])
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return ""
    lines = [re.sub(r"\s+", " ", l).strip() for l in out.splitlines()]
    # righe di solo rumore (lavagne, sfondi): servono almeno 2 lettere di fila
    return "\n".join(l for l in lines if re.search(r"[A-Za-zÀ-ÿ]{2}", l))[:1500]


def extract(ffmpeg, src, out_dir, duration, alive=lambda: True, on_progress=lambda p: None):
    """Estrae i fotogrammi chiave in out_dir e restituisce [{t0, t1, t, file, text}]."""
    out_dir = Path(out_dir)
    shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    thumbs = _thumbs(ffmpeg, src, alive)
    spans = pick_times(thumbs, duration)
    del thumbs
    exe, langs = _tesseract()
    frames = []
    for i, s in enumerate(spans):
        if not alive():
            raise RuntimeError("Interrotta")
        f = out_dir / f"f{i:04d}.jpg"
        if not _grab(ffmpeg, src, s["t"], f):
            continue
        s["file"] = f.name
        s["text"] = _ocr(exe, langs, f) if exe else ""
        frames.append(s)
        on_progress((i + 1) / max(1, len(spans)))
    (out_dir / "frames.json").write_text(json.dumps(frames, ensure_ascii=False), "utf-8")
    return frames


def load(out_dir):
    try:
        return json.loads((Path(out_dir) / "frames.json").read_text("utf-8"))
    except Exception:
        return []


def vocab(frames, limit=60):
    """Parole "da corso" lette sui fotogrammi, le piu' frequenti prima: nomi propri, termini tecnici, sigle."""
    count = {}
    for fr in frames:
        for w in re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]{3,}", fr.get("text") or ""):
            k = w.lower().strip("'-")
            # niente rumore dell'OCR tipo "SiaaAER": maiuscola solo all'inizio (o parola tutta maiuscola, sigla)
            if k in STOP or len(k) < 4 or not (re.fullmatch(r"[A-ZÀ-Ý]?[a-zà-ÿ'\-]+", w) or (w.isupper() and len(w) <= 6)):
                continue
            c = count.setdefault(k, [0, w])
            c[0] += 1
            if w[0].isupper():
                c[1] = w
    words = sorted(count.values(), key=lambda c: -c[0])
    return [w for _, w in words[:limit]]


def in_range(frames, a, b, limit=4):
    """Fotogrammi che si vedono fra a e b secondi, i piu' presenti per primi (al massimo limit), in ordine di tempo."""
    hit = [(min(b, f["t1"]) - max(a, f["t0"]), f) for f in frames if f["t1"] > a and f["t0"] < b]
    hit = [h for h in hit if h[0] > 0]
    hit.sort(key=lambda h: -h[0])
    return sorted([f for _, f in hit[:limit]], key=lambda f: f["t"])

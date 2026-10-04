#!/usr/bin/env python3
"""StudyCut - scarica, consulta, taglia i silenzi e cambia velocita' alle lezioni.
Gira sul tuo computer (127.0.0.1) oppure in Docker dietro il gateway StudyKit."""
import hashlib, json, math, os, re, shutil, subprocess, sys, threading, time, uuid, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, quote, parse_qs

BASE = Path(__file__).resolve().parent
LIB = Path(os.environ.get("STUDYCUT_LIBRARY") or BASE / "library")
STATIC = BASE / "static"
# multiutente (dietro il gateway con gli account): ogni utente ha /<USERS>/<id>/studycut e un limite di spazio
# condiviso con gli altri tool (si conta tutta la cartella /<USERS>/<id>). Senza: libreria unica, uso locale.
USERS_ROOT = Path(os.environ["STUDYCUT_USERS"]) if os.environ.get("STUDYCUT_USERS") else None
QUOTA_DEFAULT = int(float(os.environ.get("STUDYCUT_QUOTA_GB", "2")) * (1 << 30))
UID_RE = re.compile(r"^[a-f0-9]{8,40}$")
if USERS_ROOT:
    USERS_ROOT.mkdir(parents=True, exist_ok=True)
else:
    LIB.mkdir(exist_ok=True)
HOST = os.environ.get("STUDYCUT_HOST", "127.0.0.1")
PORT = int(os.environ.get("STUDYCUT_PORT", "8765"))
COOKIES = os.environ.get("STUDYCUT_COOKIES")  # file cookies.txt (formato Netscape), utile su VPS
VID_RE = re.compile(r"^[a-f0-9]{10}$")
# formati che il browser riproduce cosi' come sono / formati da convertire in MP4 all'importazione
PLAYABLE = (".mp4", ".webm", ".mkv", ".mov", ".m4v", ".m4a", ".mp3", ".wav", ".opus", ".ogg", ".aac", ".flac")
CONVERT = (".avi", ".wmv", ".flv", ".mpg", ".mpeg", ".ts", ".mts", ".m2ts", ".3gp", ".wma")
UPLOADS, UP_LOCK = {}, threading.Lock()


def all_libs():
    if not USERS_ROOT:
        return [LIB]
    return [u / "studycut" for u in USERS_ROOT.iterdir() if (u / "studycut").is_dir()]


def clean_partials():
    """All'avvio toglie le cartelle rimaste senza meta.json (upload/download interrotti)."""
    for lib in all_libs():
        for d in lib.iterdir():
            if d.is_dir() and VID_RE.match(d.name) and not (d / "meta.json").exists():
                shutil.rmtree(d, ignore_errors=True)
            elif d.is_dir() and VID_RE.match(d.name):  # file temporanei di lavori interrotti
                for f in list(d.glob("*.part.*")) + list(d.glob("graph*.txt")):
                    f.unlink(missing_ok=True)


def dir_size(root):
    total = 0
    for dp, _, files in os.walk(root):
        for f in files:
            try:
                total += os.lstat(os.path.join(dp, f)).st_size
            except OSError:
                pass
    return total


def gb(n):
    return f"{n / (1 << 30):.2f}".rstrip("0").rstrip(".").replace(".", ",") + " GB" if n >= (1 << 30) // 10 \
        else f"{max(0, n) / (1 << 20):.0f} MB"


class QuotaError(RuntimeError):
    pass


class Space:
    """Lo spazio di chi fa la richiesta: cartella della libreria e limite (None = nessun limite)."""
    def __init__(self, uid, root, quota):
        self.uid, self.root, self.quota = uid, root, quota
        self.lib = root / "studycut" if USERS_ROOT else root
        self.lib.mkdir(parents=True, exist_ok=True)

    def used(self):
        return dir_size(self.root)

    def free(self):
        """Byte ancora disponibili, tolti i caricamenti in corso. None = nessun limite."""
        if self.quota is None:
            return None
        with UP_LOCK:
            pending = sum(u["size"] - u["got"] for u in UPLOADS.values() if u["uid"] == self.uid)
        return self.quota - self.used() - pending

    def need(self, n, what="questa operazione"):
        f = self.free()
        if f is not None and n > f:
            raise QuotaError(f"Spazio esaurito: per {what} servono circa {gb(n)}, ne hai {gb(f)} liberi "
                             f"su {gb(self.quota)}. Elimina qualche video o esportazione.")

    def over(self):
        return self.quota is not None and self.used() > self.quota


def find_ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


FFMPEG = find_ffmpeg()


def ffmpeg_major():
    try:
        out = subprocess.run([FFMPEG, "-version"], capture_output=True, text=True).stdout
        m = re.search(r"ffmpeg version n?(\d+)", out)
        return int(m[1]) if m else 6
    except Exception:
        return 6


FF_MAJOR = ffmpeg_major() if FFMPEG else 0

# ---------------------------------------------------------------- jobs
JOBS, LOCK = {}, threading.Lock()


DL_SEM = threading.Semaphore(int(os.environ.get("STUDYCUT_PARALLEL", "3")))
CPU_SEM = threading.Semaphore(2)      # esportazioni e conversioni
AN_SEM = threading.Semaphore(3)       # ricerca delle pause (veloce)
PREP_SEM = threading.Semaphore(2)     # versioni senza pause in streaming: non aspettano le esportazioni


def new_job(kind, vid=None, owner="local", **extra):
    jid = uuid.uuid4().hex[:10]
    with LOCK:
        JOBS[jid] = {"id": jid, "kind": kind, "video": vid, "owner": owner, "status": "queued",
                     "progress": 0.0, "message": "In coda", "result": None,
                     "created": time.time(), "ended": None, "title": None, "thumb": None, **extra}
    return jid


def upd(jid, **kw):
    with LOCK:
        JOBS[jid].update(kw)


def run_job(jid, fn, *args, sem=None):
    def worker():
        try:
            if sem:
                sem.acquire()
            upd(jid, status="running", message="In avvio...")
            fn(jid, *args)
            upd(jid, status="done", progress=1.0, ended=time.time())
        except Exception as e:  # noqa
            upd(jid, status="error", message=str(e).strip()[-400:] or "Errore sconosciuto",
                ended=time.time())
        finally:
            if sem:
                sem.release()
    threading.Thread(target=worker, daemon=True).start()


def jobs_snapshot(owner=None):
    now = time.time()
    with LOCK:
        return [{k: v for k, v in j.items() if k != "owner"} for j in JOBS.values()
                if (owner is None or j["owner"] == owner) and (not j["ended"] or now - j["ended"] < 30)]


# ---------------------------------------------------------------- library
def mpath(lib, vid):
    return lib / vid / "meta.json"


def load_meta(lib, vid):
    return json.loads(mpath(lib, vid).read_text("utf-8"))


def save_meta(lib, m):
    p = mpath(lib, m["id"])
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(m, ensure_ascii=False, indent=1), "utf-8")
    os.replace(tmp, p)


def probe_duration(path):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True,
                       text=True, errors="ignore")
    m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def probe(path):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True,
                       text=True, errors="ignore")
    m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", r.stderr)
    dur = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0
    has_video = any("Video:" in l and "attached pic" not in l for l in r.stderr.splitlines())
    return dur, has_video


def to_mp4(path, jid=None):
    """Converte in MP4 (H.264/AAC) i formati che il browser non riproduce."""
    dst = path.with_name("video.mp4")
    if jid:
        upd(jid, message="Converto in MP4...")
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dst)],
                       capture_output=True, text=True, errors="ignore")
    if r.returncode != 0 or not dst.exists():
        raise RuntimeError("Conversione non riuscita: " + r.stderr.strip()[-300:])
    path.unlink(missing_ok=True)
    return dst


def finalize(lib, vid, path, title, source, jid=None):
    if path.suffix.lower() in CONVERT:
        path = to_mp4(path, jid)
    dur, has_video = probe(path)
    thumb = lib / vid / "thumb.jpg"
    for ext in (".jpg", ".webp", ".png"):
        yt = lib / vid / ("video" + ext)
        if yt.exists() and yt != path:
            subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(yt),
                            "-vf", "scale=640:-2", str(thumb)], capture_output=True)
            yt.unlink(missing_ok=True)
    if not thumb.exists() and has_video:
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(dur * 0.1),
                    "-i", str(path), "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4",
                    str(thumb)], capture_output=True)
    m = {"id": vid, "title": title, "source": source, "created": time.time(),
         "duration": dur, "file": path.name, "thumb": thumb.name if thumb.exists() else None,
         "audio": not has_video, "archived": False,
         "analysis": None, "exports": []}
    save_meta(lib, m)
    return m


def library(lib):
    out = []
    for d in lib.iterdir():
        if d.is_dir() and (d / "meta.json").exists():
            try:
                out.append(load_meta(lib, d.name))
            except Exception:
                pass
    for m in out:  # la mappa dei tagli serve solo al player
        if m.get("cut"):
            m["cut"] = {k: v for k, v in m["cut"].items() if k != "map"}
    return sorted(out, key=lambda m: m["created"], reverse=True)


# ---------------------------------------------------------------- download
# ---------------------------------------------------------------- anteprima link e ricerca su YouTube
LOOK_CACHE, LOOK_LOCK, LOOK_SEM = {}, threading.Lock(), threading.Semaphore(4)


def _thumb(e):
    if e.get("thumbnail"):
        return e["thumbnail"]
    th = [t for t in (e.get("thumbnails") or []) if t.get("url")]
    mid = [t for t in th if 200 <= (t.get("width") or 0) <= 720]
    if mid or th:
        return (mid or th)[-1]["url"]
    if e.get("id") and "youtube" in str(e.get("ie_key") or e.get("extractor_key") or e.get("url") or "").lower():
        return f"https://i.ytimg.com/vi/{e['id']}/mqdefault.jpg"
    return None


def _brief(e, url=None):
    u = url or e.get("webpage_url") or e.get("url") or ""
    if e.get("id") and not u.startswith("http"):
        u = f"https://www.youtube.com/watch?v={e['id']}"
    return {"url": u, "title": e.get("title") or "", "channel": e.get("channel") or e.get("uploader") or "",
            "duration": e.get("duration"), "views": e.get("view_count"), "thumb": _thumb(e),
            "live": e.get("live_status") in ("is_live", "is_upcoming") or bool(e.get("is_live")),
            "date": e.get("upload_date"), "site": e.get("extractor_key") or e.get("ie_key") or "",
            "playlist": e.get("_type") == "playlist"}


YT_ID = re.compile(r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/)|youtu\.be/)([\w-]{11})")


def yt_id(url):
    m = YT_ID.search(url)
    return m and m[1]


def yt_oembed(url, vid):
    import urllib.request
    r = json.loads(urllib.request.urlopen("https://www.youtube.com/oembed?format=json&url=" + quote(url, safe=""), timeout=10).read())
    return {"url": url, "title": r.get("title") or "", "channel": r.get("author_name") or "", "duration": None, "views": None,
            "thumb": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg", "live": False, "date": None, "site": "Youtube", "playlist": False}


def yt_look(kind, value):
    """kind "probe": informazioni su un link (senza scaricare) · kind "search": primi risultati su YouTube."""
    key = (kind, value)
    with LOOK_LOCK:
        hit = LOOK_CACHE.get(key)
        if hit and time.time() - hit[0] < 900:
            return hit[1]
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("yt-dlp non installato")
    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True,
            "extract_flat": True if kind == "search" else "in_playlist", "socket_timeout": 15,
            # titoli originali (senza traduzione automatica in inglese)
            "extractor_args": {"youtube": {"lang": [os.environ.get("STUDYCUT_LANG", "it")]}}}
    if COOKIES and Path(COOKIES).is_file():
        opts["cookiefile"] = COOKIES
    with LOOK_SEM:
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                if kind == "search":
                    info = ydl.extract_info(f"ytsearch12:{value}", download=False)
                    out = [_brief(e) for e in (info.get("entries") or []) if e and e.get("id")]
                    out = [r for r in out if not r["playlist"]][:10]
                elif yt_id(value):
                    # video YouTube: la ricerca per id e' veloce e non incappa nel controllo "non sei un bot"
                    vid = yt_id(value)
                    info = ydl.extract_info(f'ytsearch5:"{vid}"', download=False)
                    hit = next((e for e in (info.get("entries") or []) if e and e.get("id") == vid), None)
                    out = _brief(hit, value) if hit else yt_oembed(value, vid)
                else:
                    # process=False: solo i dati della pagina, senza scegliere i formati (molto piu' veloce)
                    info = ydl.extract_info(value, download=False, process=False)
                    if info.get("_type") == "url" and info.get("url") and info.get("url") != value:
                        info = ydl.extract_info(info["url"], download=False, process=False)
                    out = _brief(info, value)
        except Exception as e:
            msg = re.sub(r"\x1b\[[0-9;]*m", "", str(e)).replace("ERROR: ", "")
            raise RuntimeError(re.sub(r"^\[[^\]]+\]\s*[\w-]*:?\s*", "", msg)[:300] or "Non trovato")
    with LOOK_LOCK:
        if len(LOOK_CACHE) > 400:
            LOOK_CACHE.clear()
        LOOK_CACHE[key] = (time.time(), out)
    return out


def job_download(jid, sp, url, quality):
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("yt-dlp non installato: esegui  pip install -U \"yt-dlp[default]\"")
    lib = sp.lib
    sp.need(50 << 20, "scaricare un video")
    auto, m = False, None
    vid = uuid.uuid4().hex[:10]
    d = lib / vid
    d.mkdir()
    upd(jid, video=vid, message="Recupero informazioni...")
    last_check = [0.0]
    audio = quality == "audio"
    h = int(quality) if str(quality).isdigit() else 1080
    fmt = "ba[ext=m4a]/ba/b" if audio else (
        f"bv*[vcodec^=avc1][height<={h}]+ba[ext=m4a]/b[ext=mp4][height<={h}]/"
        f"bv*[height<={h}]+ba/b[height<={h}]/b")

    def hook(s):
        info = s.get("info_dict") or {}
        with LOCK:
            j = JOBS[jid]
            if not j["title"] and info.get("title"):
                j["title"] = info["title"]
                j["thumb"] = info.get("thumbnail")
        kind = "video" if (s.get("info_dict") or {}).get("vcodec", "none") != "none" else "audio"
        if s["status"] == "downloading":
            # limite di spazio: controllato mentre scarica (il peso esatto spesso non si sa prima)
            if sp.quota is not None and time.time() - last_check[0] > 1.5:
                last_check[0] = time.time()
                if sp.over():
                    raise QuotaError(f"Spazio esaurito: hai raggiunto {gb(sp.quota)}. Elimina qualche video e riprova.")
            tot = s.get("total_bytes") or s.get("total_bytes_estimate") or 0
            done = s.get("downloaded_bytes") or 0
            speed = s.get("speed") or 0
            eta = s.get("eta")
            msg = f"Download {kind}  {done/1e6:.0f}/{tot/1e6:.0f} MB"
            if speed:
                msg += f"  ·  {speed/1e6:.1f} MB/s"
            if eta:
                msg += f"  ·  {int(eta)}s"
            upd(jid, progress=(done / tot * 0.95) if tot else 0, message=msg)
        elif s["status"] == "finished":
            upd(jid, message="Elaborazione...")

    opts = {"format": fmt, "outtmpl": str(d / "video.%(ext)s"), "merge_output_format": "mp4",
            "noplaylist": True, "quiet": True, "no_warnings": True, "noprogress": True,
            "progress_hooks": [hook], "writethumbnail": True,
            "postprocessors": ([{"key": "FFmpegExtractAudio", "preferredcodec": "m4a"}] if audio else [])
            + [{"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"}]}
    if FFMPEG:
        opts["ffmpeg_location"] = FFMPEG
    if COOKIES and Path(COOKIES).is_file():
        opts["cookiefile"] = COOKIES
    def fetch(extra):
        with yt_dlp.YoutubeDL({**opts, **extra}) as ydl:
            return ydl.extract_info(url, download=True)
    try:
        try:
            info = fetch({})
        except Exception as e:
            # YouTube a volte chiede l'accesso: riprova con i cookie del browser in uso
            if COOKIES or not re.search(r"Sign in|login|cookies|bot", str(e), re.I):
                raise
            info, last = None, e
            pref = os.environ.get("STUDYCUT_BROWSER")
            for br in ([pref] if pref else []) + ["chrome", "firefox", "edge", "safari", "brave"]:
                upd(jid, message=f"Riprovo con i cookie di {br.capitalize()}...")
                try:
                    info = fetch({"cookiesfrombrowser": (br,)})
                    break
                except Exception as e2:
                    last = e2
            if info is None:
                raise RuntimeError(str(e) + "  (Accedi a YouTube in Chrome/Firefox su questo computer e riprova.)")
        files = [f for f in d.iterdir() if f.name.startswith("video.") and
                 f.suffix not in (".part", ".ytdl", ".json", ".jpg", ".webp", ".png")]
        if not files:
            raise RuntimeError("Download non riuscito")
        upd(jid, message="Creo anteprima...")
        m = finalize(lib, vid, files[0], info.get("title") or "Video", url)
        if sp.over():
            raise QuotaError(f"Spazio esaurito: il video supera il tuo spazio di {gb(sp.quota)}. Elimina qualche video e riprova.")
        upd(jid, result={"video": vid}, message=m["title"])
        auto = True
    except Exception as e:
        shutil.rmtree(d, ignore_errors=True)
        if isinstance(e, QuotaError) or "Spazio esaurito" in str(e):
            raise RuntimeError(re.sub(r"^.*?(Spazio esaurito)", r"\1", str(e)))
        msg = re.sub(r"\x1b\[[0-9;]*m", "", str(e)).replace("ERROR: ", "")
        raise RuntimeError(msg)
    if auto:  # cerca subito le pause (e poi prepara la versione senza pause), anche a pagina chiusa
        start_analyze(sp, vid, title=m["title"])


# ---------------------------------------------------------------- silences
DEFAULT_ANALYSIS = (-35.0, 0.6, 0.12)
PREP = {}  # (uid, vid) -> chiave dell'analisi che si sta preparando (per fermare le preparazioni superate)


def start_analyze(sp, vid, noise=None, mind=None, pad=None, title=None):
    noise, mind, pad = [d if v is None else v for v, d in zip((noise, mind, pad), DEFAULT_ANALYSIS)]
    jid = new_job("analyze", vid, owner=sp.uid, title=title)
    run_job(jid, job_analyze, sp, vid, noise, mind, pad, sem=AN_SEM)
    return jid


def job_analyze(jid, sp, vid, noise, mind, pad):
    lib = sp.lib
    m = load_meta(lib, vid)
    src, dur = lib / vid / m["file"], m["duration"] or 1
    upd(jid, message="Analisi audio...")
    cmd = [FFMPEG, "-hide_banner", "-i", str(src), "-vn", "-af",
           f"silencedetect=noise={noise}dB:d={mind}", "-f", "null", "-"]
    p = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True,
                         errors="ignore")
    sil, cur = [], None
    for line in p.stderr:  # universal newlines: also splits on \r
        if "silence_start" in line:
            cur = float(re.search(r"silence_start:\s*(-?[\d.]+)", line)[1])
        elif "silence_end" in line:
            e = float(re.search(r"silence_end:\s*([\d.]+)", line)[1])
            sil.append([max(0.0, cur if cur is not None else 0.0), e])
            cur = None
        else:
            t = re.search(r"time=(\d+):(\d+):([\d.]+)", line)
            if t:
                sec = int(t[1]) * 3600 + int(t[2]) * 60 + float(t[3])
                upd(jid, progress=min(0.99, sec / dur), message=f"Analisi audio  {int(sec/dur*100)}%")
    p.wait()
    if p.returncode != 0:
        raise RuntimeError("Analisi non riuscita (il video ha una traccia audio?)")
    if cur is not None:
        sil.append([cur, dur])
    # zone saltate = silenzi ristretti del margine, per non tagliare l'inizio/fine delle parole
    skips = []
    for a, b in sil:
        a2 = 0.0 if a <= 0.01 else a + pad
        b2 = dur if b >= dur - 0.01 else b - pad
        if b2 - a2 > 0.08:
            skips.append([round(a2, 3), round(b2, 3)])
    removed = sum(b - a for a, b in skips)
    key = hashlib.sha1(json.dumps([round(dur, 3), skips]).encode()).hexdigest()[:10]
    m = load_meta(lib, vid)
    m["analysis"] = {"noise": noise, "min": mind, "pad": pad, "skips": skips, "key": key,
                     "kept": max(0.0, dur - removed), "count": len(skips)}
    old = m.get("cut")
    if not (old and old.get("key") == key):
        m["cut"] = None
        if old:
            remove_cut(lib, vid, old)
    m.pop("cut_error", None)
    save_meta(lib, m)
    # subito: la versione gia' tagliata, in streaming mentre si crea (prima di chiudere l'analisi,
    # cosi' il player la trova appena l'analisi risulta finita)
    if skips and not m.get("cut"):
        start_prepare(sp, vid, m)
    upd(jid, result={"video": vid}, message=f"{len(skips)} silenzi trovati")


def keep_segments(skips, dur):
    keep, t = [], 0.0
    for a, b in skips:
        if a > t:
            keep.append((t, a))
        t = max(t, b)
    if dur > t:
        keep.append((t, dur))
    return [(a, b) for a, b in keep if b - a > 0.03]


def atempo_chain(s):
    parts = []
    while s > 2.0:
        parts.append(2.0); s /= 2.0
    while s < 0.5:
        parts.append(0.5); s /= 0.5
    parts.append(s)
    return ",".join(f"atempo={x:.5f}" for x in parts)


STD_FPS = {23.976: "24000/1001", 29.97: "30000/1001", 59.94: "60000/1001", 47.952: "48000/1001"}


def streams(path):
    """Indici (tra i flussi dello stesso tipo) del video principale e dell'audio, e frame rate."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True,
                       text=True, errors="ignore")
    v_idx = a_idx = None
    nv = na = 0
    fps = None
    for l in r.stderr.splitlines():
        if not re.match(r"\s*Stream #\d+:\d+", l):
            continue
        if ": Video:" in l:
            if v_idx is None and "attached pic" not in l:
                v_idx = nv
                f = re.search(r"([\d.]+)\s*fps", l) or re.search(r"([\d.]+)\s*tbr", l)
                fps = float(f[1]) if f else None
            nv += 1
        elif ": Audio:" in l:
            if a_idx is None:
                a_idx = na
            na += 1
    if not fps or fps <= 1 or fps > 240:
        fps = 30.0
    fps = min(fps, 60.0)
    for k, s in STD_FPS.items():
        if abs(fps - k) < 0.02:
            return v_idx, a_idx, s, int(s.split("/")[0]) / int(s.split("/")[1])
    fps = round(fps, 3)
    return v_idx, a_idx, f"{fps:g}", fps


ACH = 1024      # campioni per blocco audio dopo asetnsamples
SR = 48000


def cut_plan(keep, rate):
    """Converte i tratti da tenere in intervalli di fotogrammi (video) e di blocchi audio, mantenendo
    l'audio allineato al video entro mezzo blocco (~10 ms) su tutta la durata.
    Restituisce (frames, chunks, map) con map = [[inizio_originale, inizio_tagliato, durata], ...]."""
    c = ACH / SR
    frames, chunks, mp = [], [], []
    vt = at = 0.0
    last_chunk = -1
    for a, b in keep:
        ka, kb = math.ceil(a * rate - 1e-6), math.ceil(b * rate - 1e-6) - 1
        if kb < ka:
            continue
        n = kb - ka + 1
        mp.append([round(ka / rate, 4), round(vt, 4), round(n / rate, 4)])
        frames.append((ka, kb))
        vt += n / rate
        na = max(round(ka / rate / c), last_chunk + 1)
        cnt = round((vt - at) / c)
        if cnt > 0:
            chunks.append((na, na + cnt - 1))
            last_chunk = na + cnt - 1
            at += cnt * c
    return frames, chunks, mp, vt


def sel_expr(r):
    """Espressione bilanciata (O(log n) per fotogramma): vero se n cade in uno degli intervalli."""
    if len(r) == 1:
        return f"between(n,{r[0][0]},{r[0][1]})"
    mid = len(r) // 2
    return f"if(lt(n,{r[mid][0]}),{sel_expr(r[:mid])},{sel_expr(r[mid:])})"


def build_cmd(src, out, is_audio, keep=None, speed=1.0, x264="veryfast", crf=23, gdir=None, hls=None):
    """Comando ffmpeg che toglie i tratti non in `keep` (se dato) e cambia la velocita'.
    Restituisce (cmd, durata_in_uscita, map)."""
    v_idx, a_idx, rate_s, rate = streams(src)
    if is_audio:
        v_idx = None
    if v_idx is None and a_idx is None:
        raise RuntimeError("Il file non contiene ne' audio ne' video")
    if keep is not None and a_idx is None:
        raise RuntimeError("Per togliere i silenzi serve una traccia audio")
    vf, af, mp, out_dur = [], [], None, None
    if v_idx is not None:
        vf.append(f"fps=fps={rate_s}:start_time=0")
    if a_idx is not None:
        af.append(f"aresample={SR}:async=1:first_pts=0")
    if keep is not None:
        frames, chunks, mp, out_dur = cut_plan(keep, rate)
        if not frames or not chunks:
            raise RuntimeError("Dopo il taglio non resta niente: abbassa la soglia o la pausa minima")
        if v_idx is not None:
            vf += [f"select='{sel_expr(frames)}'", "setpts=N/FRAME_RATE/TB"]
        af += [f"asetnsamples=n={ACH}:p=0", f"aselect='{sel_expr(chunks)}'", "asetpts=N/SR/TB"]
    if abs(speed - 1) > 1e-3:
        if v_idx is not None:
            vf += [f"setpts=PTS/{speed:.5f}", f"fps=fps={rate_s}"]
        if a_idx is not None:
            af.append(atempo_chain(speed))
    if v_idx is not None:
        vf += ["scale=trunc(iw/2)*2:trunc(ih/2)*2", "format=yuv420p"]
    graph = []
    if v_idx is not None:
        graph.append(f"[0:v:{v_idx}]{','.join(vf)}[v]")
    if a_idx is not None:
        graph.append(f"[0:a:{a_idx}]{','.join(af)}[a]")
    graph = ";".join(graph)
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", str(src)]
    if len(graph) > 6000 and gdir:  # grafi lunghi -> file (limiti della riga di comando)
        gfile = gdir / f"graph_{uuid.uuid4().hex[:6]}.txt"
        gfile.write_text(graph, "utf-8")
        cmd += (["-/filter_complex", str(gfile)] if FF_MAJOR >= 7 else ["-filter_complex_script", str(gfile)])
    else:
        gfile = None
        cmd += ["-filter_complex", graph]
    if v_idx is not None:
        g = max(12, int(round(rate * 2)))  # un fotogramma chiave ogni ~2 s: ricerca veloce nel player
        cmd += ["-map", "[v]", "-r", rate_s, "-c:v", "libx264", "-preset", x264, "-crf", str(crf),
                "-g", str(g), "-profile:v", "high", "-pix_fmt", "yuv420p"]
        if hls:  # un fotogramma chiave all'inizio di ogni pezzo dello streaming
            cmd += ["-force_key_frames", f"expr:gte(t,n_forced*{SEG})"]
    if a_idx is not None:
        cmd += ["-map", "[a]", "-c:a", "aac", "-b:a", "128k", "-ac", "2"]
    if is_audio or v_idx is None:
        cmd += ["-vn"]
    cmd += ["-sn", "-dn", "-map_metadata", "-1"]
    if hls:  # streaming tipo YouTube: pezzi fMP4 da SEG secondi, playlist che cresce mentre si crea
        cmd += ["-f", "hls", "-hls_time", str(SEG), "-hls_list_size", "0", "-hls_playlist_type", "event",
                "-hls_segment_type", "fmp4", "-hls_fmp4_init_filename", "init.mp4",
                "-hls_flags", "independent_segments+temp_file",
                "-hls_segment_filename", str(hls / "seg_%05d.m4s")]
    else:
        cmd += ["-movflags", "+faststart"]
    cmd += ["-progress", "pipe:1", "-nostats", str(out)]
    return cmd, out_dur, mp, gfile


def run_ffmpeg(jid, cmd, sp, out_dur, label, alive=None):
    """Esegue ffmpeg con avanzamento; si ferma se finisce lo spazio o se alive() diventa falso."""
    upd(jid, message=f"{label}...")
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                         errors="ignore")
    err = []
    threading.Thread(target=lambda: err.extend(p.stderr), daemon=True).start()
    last, why = time.time(), None
    for line in p.stdout:
        if time.time() - last > 2:
            last = time.time()
            if sp.quota is not None and sp.over():
                why = "quota"
            elif alive and not alive():
                why = "stop"
            if why:
                p.kill()
                break
        if line.startswith(("out_time_us=", "out_time_ms=")):
            try:
                sec = int(line.split("=")[1]) / 1e6
                pr = min(0.99, sec / max(out_dur, 0.1))
                upd(jid, progress=pr, message=f"{label}  {int(pr * 100)}%")
            except ValueError:
                pass
    p.wait()
    return p.returncode, why, "".join(err)


def cut_ready(m):
    c, a = m.get("cut"), m.get("analysis")
    return bool(c and a and c.get("key") == a.get("key") and c.get("ready", True))


def cut_path(lib, vid, c):
    """Ingresso per ffmpeg della versione senza pause (playlist HLS, o file .mp4 delle versioni vecchie)."""
    return lib / vid / c["dir"] / "index.m3u8" if c.get("hls") else lib / vid / c["file"]


def remove_cut(lib, vid, c=None, keep_name=None):
    """Cancella la versione senza pause indicata (o tutte tranne keep_name)."""
    names = [c.get("dir") or c.get("file")] if c else [p.name for p in (lib / vid).glob("cut_*")]
    for n in names:
        if not n or n == keep_name:
            continue
        p = lib / vid / n
        shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)


SEG = 2  # secondi per pezzo dello streaming


def start_prepare(sp, vid, m):
    """Pianifica la versione senza pause e la scrive in meta subito: il player puo' iniziare a
    riprodurla in streaming (HLS a pezzi da 2 s) mentre ffmpeg la sta ancora creando."""
    lib, k, key = sp.lib, (sp.uid, vid), m["analysis"]["key"]
    with LOCK:
        if PREP.get(k) == key:
            return m
        PREP[k] = key
    d = lib / vid / f"cut_{key}"
    try:
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir()
        keep = keep_segments(m["analysis"]["skips"], m["duration"] or 0)
        cmd, out_dur, mp, gfile = build_cmd(lib / vid / m["file"], d / "index.m3u8", m.get("audio", False),
                                            keep=keep, x264="superfast", crf=23, gdir=lib / vid, hls=d)
    except Exception as e:
        with LOCK:
            PREP.pop(k, None)
        shutil.rmtree(d, ignore_errors=True)
        m = load_meta(lib, vid)
        m["cut"], m["cut_error"] = None, {"key": key, "msg": str(e)[-300:], "quota": False, "at": time.time()}
        save_meta(lib, m)
        return m
    m = load_meta(lib, vid)
    old = m.get("cut")
    if old and old.get("key") != key:
        remove_cut(lib, vid, old)
    m["cut"] = {"dir": d.name, "key": key, "hls": True, "ready": False,
                "duration": round(out_dur, 3), "map": mp}
    m.pop("cut_error", None)
    save_meta(lib, m)
    jid = new_job("prepare", vid, owner=sp.uid, title=m["title"])
    run_job(jid, job_prepare, sp, vid, key, cmd, out_dur, gfile, sem=PREP_SEM)
    return m


def job_prepare(jid, sp, vid, key, cmd, out_dur, gfile):
    lib, k = sp.lib, (sp.uid, vid)
    d = lib / vid / f"cut_{key}"
    alive = lambda: PREP.get(k) == key and mpath(lib, vid).exists()
    try:
        if not alive():
            shutil.rmtree(d, ignore_errors=True)
            return upd(jid, message="Superata da un'analisi piu' recente")
        m = load_meta(lib, vid)
        src, dur = lib / vid / m["file"], m["duration"] or 0
        try:
            sp.need(int(src.stat().st_size * out_dur / max(dur, 0.1) * 1.15) + (20 << 20),
                    "preparare la versione senza pause")
        except QuotaError as e:
            raise QuotaError(f"{e} Intanto i silenzi vengono saltati durante la riproduzione.")
        code, why, err = run_ffmpeg(jid, cmd, sp, out_dur, "Preparo la versione senza pause", alive)
        if why == "quota":
            raise QuotaError(f"Spazio esaurito: hai raggiunto {gb(sp.quota)}. "
                             "Intanto i silenzi vengono saltati durante la riproduzione.")
        if why == "stop":
            shutil.rmtree(d, ignore_errors=True)
            return upd(jid, message="Superata da un'analisi piu' recente")
        if code != 0 or not (d / "index.m3u8").exists():
            raise RuntimeError("ffmpeg: " + err.strip()[-300:])
        m = load_meta(lib, vid)
        if not (m.get("cut") and m["cut"].get("key") == key):
            shutil.rmtree(d, ignore_errors=True)
            return upd(jid, message="Superata da un'analisi piu' recente")
        m["cut"]["ready"], m["cut"]["size"] = True, dir_size(d)
        remove_cut(lib, vid, keep_name=d.name)
        save_meta(lib, m)
        upd(jid, result={"video": vid}, message="Versione senza pause pronta")
    except Exception as e:
        shutil.rmtree(d, ignore_errors=True)
        try:
            m = load_meta(lib, vid)
            if m.get("cut") and m["cut"].get("key") == key:
                m["cut"] = None
                m["cut_error"] = {"key": key, "msg": str(e)[-300:], "quota": isinstance(e, QuotaError),
                                  "at": time.time()}
                save_meta(lib, m)
        except Exception:
            pass
        raise
    finally:
        if gfile is not None:
            gfile.unlink(missing_ok=True)
        with LOCK:
            if PREP.get(k) == key:
                PREP.pop(k, None)


def video_codec(path):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True, errors="ignore")
    for l in r.stderr.splitlines():
        mm = re.search(r"Stream #\d+:\d+.*: Video: (\w+)", l)
        if mm and "attached pic" not in l:
            return mm[1]
    return None


def wait_cut(jid, sp, vid, key):
    """Se la versione senza pause si sta ancora creando, l'esportazione la aspetta: finisce molto prima
    che ricominciare da zero dall'originale, e poi l'esportazione e' quasi istantanea."""
    k = (sp.uid, vid)
    while PREP.get(k) == key:
        with LOCK:
            pj = next((j for j in JOBS.values() if j["kind"] == "prepare" and j["video"] == vid
                       and j["owner"] == sp.uid and not j["ended"]), None)
        pr = pj["progress"] if pj else 0.0
        upd(jid, progress=pr * 0.9, message=f"Aspetto la versione senza pause  {int(pr * 100)}%")
        time.sleep(1)


MAX_COPY_FPS = 91  # fino a 3x di un video a 30 fps senza ricodificare; oltre si ricodifica


def job_export(jid, sp, vid, speed, remove):
    lib = sp.lib
    m = load_meta(lib, vid)
    if remove and not m.get("analysis"):
        raise RuntimeError("Analizza prima i silenzi")
    if remove and m.get("cut") and m["cut"].get("key") == m["analysis"].get("key") and not cut_ready(m):
        wait_cut(jid, sp, vid, m["cut"]["key"])
        m = load_meta(lib, vid)
    orig = lib / vid / m["file"]
    dur = m["duration"] or probe_duration(orig)
    is_audio = m.get("audio", False)
    tag = f"{speed:g}x".replace(".", ",") + ("_senza-silenzi" if remove else "")
    name = f"export_{tag}.{'m4a' if is_audio else 'mp4'}"
    out = lib / vid / name
    tmp = lib / vid / f"{name}.part{out.suffix}"
    keep, src = None, orig
    if remove and cut_ready(m) and cut_path(lib, vid, m["cut"]).exists():
        src, base = cut_path(lib, vid, m["cut"]), m["cut"]["duration"]  # versione senza pause gia' pronta
    elif remove:
        keep = keep_segments(m["analysis"]["skips"], dur)
        base = sum(b - a for a, b in keep)
    else:
        base = dur
    out_dur = base / speed
    # peso stimato dell'esportazione: come l'originale, in proporzione alla durata
    sp.need(int(orig.stat().st_size * out_dur / max(dur or 1, 0.1) * 1.1) + (20 << 20), "questa esportazione")
    v_idx, a_idx, rate_s, rate = streams(src)
    if is_audio:
        v_idx = None
    # veloce: il video non si ricodifica, si cambiano solo i tempi dei fotogrammi (-itsscale);
    # si ricodifica solo l'audio con atempo, che costa pochissimo
    fast = keep is None and (v_idx is None or (video_codec(src) == "h264" and rate * speed <= MAX_COPY_FPS))
    gfile = None
    try:
        if fast:
            one = abs(speed - 1) < 1e-3
            cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-nostdin", "-y"]
            if v_idx is not None:
                cmd += (["-itsscale", f"{1 / speed:.8f}"] if not one else []) + ["-i", str(src)]
            cmd += ["-i", str(src)]
            ai = 1 if v_idx is not None else 0
            if v_idx is not None:
                cmd += ["-map", f"0:v:{v_idx}", "-c:v", "copy"]
            if a_idx is not None:
                cmd += ["-map", f"{ai}:a:{a_idx}"]
                cmd += ["-c:a", "copy"] if one else ["-af", atempo_chain(speed), "-c:a", "aac", "-b:a", "128k"]
            if v_idx is None:
                cmd += ["-vn"]
            cmd += ["-sn", "-dn", "-map_metadata", "-1", "-movflags", "+faststart",
                    "-progress", "pipe:1", "-nostats", str(tmp)]
        else:
            cmd, _, _, gfile = build_cmd(src, tmp, is_audio, keep=keep, speed=speed, x264="superfast", gdir=lib / vid)
        code, why, err = run_ffmpeg(jid, cmd, sp, out_dur, "Esportazione", lambda: mpath(lib, vid).exists())
        if why == "quota":
            raise QuotaError(f"Spazio esaurito durante l'esportazione: hai raggiunto {gb(sp.quota)}. "
                             "Elimina qualche video e riprova.")
        if why == "stop":
            raise RuntimeError("Video eliminato durante l'esportazione")
        if code != 0 or not tmp.exists() or tmp.stat().st_size == 0:
            raise RuntimeError("ffmpeg: " + err.strip()[-300:])
        os.replace(tmp, out)
    finally:
        tmp.unlink(missing_ok=True)
        if gfile is not None:
            gfile.unlink(missing_ok=True)
    m = load_meta(lib, vid)
    m["exports"] = [e for e in m.get("exports", []) if e["file"] != name]
    m["exports"].insert(0, {"file": name, "speed": speed, "remove": remove,
                            "duration": out_dur, "size": out.stat().st_size,
                            "created": time.time()})
    save_meta(lib, m)
    upd(jid, result={"video": vid, "file": name}, message="Esportazione completata")


# ---------------------------------------------------------------- http
CTYPES = {".m3u8": "application/vnd.apple.mpegurl", ".m4s": "video/iso.segment", ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
          ".mov": "video/quicktime", ".jpg": "image/jpeg", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
          ".opus": "audio/ogg", ".png": "image/png", ".webp": "image/webp",
          ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2"}


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def send_json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def err(self, msg, code=400):
        self.send_json({"error": msg}, code)

    def body(self):
        return json.loads(b"".join(self.stream()) or b"{}")

    def stream(self, limit=None):
        """Legge il corpo della richiesta a blocchi, con Content-Length o Transfer-Encoding: chunked
        (alcuni proxy HTTP/2 -> HTTP/1.1 non inoltrano Content-Length)."""
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    while self.rfile.readline() not in (b"\r\n", b"\n", b""):
                        pass
                    return
                while size > 0:
                    chunk = self.rfile.read(min(1 << 20, size))
                    if not chunk:
                        return
                    size -= len(chunk)
                    yield chunk
                self.rfile.readline()
        else:
            n = int(self.headers.get("Content-Length") or 0)
            while n > 0:
                chunk = self.rfile.read(min(1 << 20, n))
                if not chunk:
                    return
                n -= len(chunk)
                yield chunk

    def drain(self):
        for _ in self.stream():
            pass

    def send_file(self, path, download_name=None):
        size = path.stat().st_size
        ctype = CTYPES.get(path.suffix.lower(), "application/octet-stream")
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        m = re.match(r"bytes=(\d*)-(\d*)", rng or "")
        if m and size:
            if m[1]:
                start = int(m[1]); end = int(m[2]) if m[2] else size - 1
            elif m[2]:
                start = max(0, size - int(m[2]))
            end = min(end, size - 1)
            if start > end:
                self.send_response(416); self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0"); self.end_headers(); return
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if ctype.startswith(("text/html", "text/javascript", "text/css")) or path.suffix == ".m3u8":
            self.send_header("Cache-Control", "no-store")
        if download_name:
            self.send_header("Content-Disposition",
                             f"attachment; filename*=UTF-8''{quote(download_name)}")
        self.end_headers()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(256 * 1024, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    # ---- chi sta chiedendo
    def space(self):
        """Spazio dell'utente della richiesta. In multiutente l'identita' arriva dal gateway (X-User-Id)."""
        if not USERS_ROOT:
            return Space("local", LIB, None)
        uid = (self.headers.get("X-User-Id") or "").strip().lower()
        if not UID_RE.match(uid):
            return None
        try:
            quota = int(self.headers.get("X-User-Quota") or QUOTA_DEFAULT)
        except ValueError:
            quota = QUOTA_DEFAULT
        return Space(uid, USERS_ROOT / uid, quota)

    def need_space(self):
        sp = self.space()
        if not sp:
            self.drain()
            self.err("Accesso richiesto: entra con il tuo account", 401)
        return sp

    # ---- GET
    def do_GET(self):
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        if not parts or parts == ["index.html"]:
            return self.send_file(STATIC / "index.html")
        if len(parts) == 1 and re.match(r"^[\w-]+\.(js|css|svg|png|woff2)$", parts[0]) and (STATIC / parts[0]).is_file():
            return self.send_file(STATIC / parts[0])
        if parts == ["api", "status"]:
            try:
                import yt_dlp
                ver = yt_dlp.version.__version__
            except Exception:
                ver = None
            return self.send_json({"ffmpeg": bool(FFMPEG), "ytdlp": ver, "multiuser": bool(USERS_ROOT)})
        # lavori di tutti: solo dall'interno del container (controllo prima del riavvio per aggiornare yt-dlp)
        if parts == ["api", "jobs"] and USERS_ROOT and not self.headers.get("X-User-Id") and self.client_address[0] == "127.0.0.1":
            return self.send_json(jobs_snapshot())
        sp = self.need_space()
        if not sp:
            return
        lib = sp.lib
        if parts == ["api", "space"]:
            return self.send_json({"used": sp.used(), "quota": sp.quota, "multiuser": bool(USERS_ROOT),
                                   "user": self.headers.get("X-User-Name") if USERS_ROOT else None})
        if parts == ["api", "probe"]:
            url = (parse_qs(u.query).get("url") or [""])[0].strip()
            if not re.match(r"^https?://\S+$", url) or len(url) > 2000:
                return self.err("Link non valido")
            try:
                return self.send_json(yt_look("probe", url))
            except Exception as e:
                return self.err(str(e), 422)
        if parts == ["api", "search"]:
            q = re.sub(r"\s+", " ", (parse_qs(u.query).get("q") or [""])[0]).strip()
            if not 1 <= len(q) <= 150:
                return self.err("Scrivi cosa cercare")
            try:
                return self.send_json({"q": q, "results": yt_look("search", q)})
            except Exception as e:
                return self.err(str(e), 422)
        if parts == ["api", "library"]:
            return self.send_json(library(lib))
        if len(parts) == 3 and parts[:2] == ["api", "video"] and VID_RE.match(parts[2]):
            if not mpath(lib, parts[2]).exists():
                return self.err("Video non trovato", 404)
            m = load_meta(lib, parts[2])
            # video analizzati prima di questa versione (o preparazione interrotta): la prepara ora
            a, ce = m.get("analysis"), m.get("cut_error") or {}
            if a and a.get("skips") and FFMPEG:
                if not a.get("key"):
                    a["key"] = hashlib.sha1(json.dumps([round(m["duration"] or 0, 3), a["skips"]]).encode()).hexdigest()[:10]
                    save_meta(lib, m)
                # dopo un errore si riprova solo con una nuova analisi, o (spazio esaurito) dopo 2 minuti
                retry = ce.get("key") != a["key"] or (ce.get("quota") and time.time() - ce.get("at", 0) > 120)
                if not cut_ready(m) and retry:
                    m = start_prepare(sp, parts[2], m)
            return self.send_json(m)
        if parts == ["api", "jobs"]:
            return self.send_json(jobs_snapshot(sp.uid))
        if len(parts) == 3 and parts[:2] == ["api", "jobs"]:
            with LOCK:
                j = JOBS.get(parts[2])
                j = {k: v for k, v in j.items() if k != "owner"} if j and j["owner"] == sp.uid else None
            return self.send_json(j) if j else self.err("Job non trovato", 404)
        # pezzi dello streaming: media/<id>/cut_<chiave>/<file>
        if len(parts) == 4 and parts[0] == "media" and VID_RE.match(parts[1]) \
                and re.match(r"^cut_[a-f0-9]{10}$", parts[2]) and re.match(r"^[\w-]+\.(m3u8|m4s|mp4)$", parts[3]):
            p = lib / parts[1] / parts[2] / parts[3]
            return self.send_file(p) if p.is_file() else self.err("Non ancora pronto", 404)
        if len(parts) == 3 and parts[0] == "media" and VID_RE.match(parts[1]):
            vid, name = parts[1], parts[2]
            if "/" in name or "\\" in name or name.startswith("."):
                return self.err("Nome non valido")
            p = lib / vid / name
            if not p.is_file():
                return self.err("File non trovato", 404)
            dl = None
            if "dl" in parse_qs(u.query):
                title = re.sub(r'[\\/:*?"<>|]+', "_", load_meta(lib, vid)["title"])[:120]
                dl = f"{title} - {name.replace('export_', '')}" if name.startswith("export_") \
                    else f"{title}{p.suffix}"
            return self.send_file(p, dl)
        self.err("Non trovato", 404)

    def cross_site(self):
        """Blocca richieste di modifica partite da altri siti (CSRF)."""
        origin = self.headers.get("Origin")
        if not origin:
            return False
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or ""
        return urlparse(origin).netloc != host

    # ---- POST
    def do_POST(self):
        if self.cross_site():
            self.drain()
            return self.err("Richiesta non consentita", 403)
        sp = self.need_space()
        if not sp:
            return
        lib = sp.lib
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if parts == ["api", "import"]:
            return self.import_file(sp)
        if parts[:2] == ["api", "upload"]:
            return self.upload_post(sp, parts[2:])
        try:
            data = self.body()
        except Exception:
            return self.err("JSON non valido")
        if not FFMPEG:
            return self.err("ffmpeg non trovato: installa ffmpeg o  pip install imageio-ffmpeg")
        if parts == ["api", "download"]:
            raw = data.get("urls") or [data.get("url") or ""]
            urls = list(dict.fromkeys(u.strip() for u in raw if re.match(r"^https?://\S+$", u.strip())))
            if not urls:
                return self.err("Inserisci almeno un link valido")
            try:
                sp.need(50 << 20, "scaricare un video")
            except QuotaError as e:
                return self.err(str(e), 413)
            q = str(data.get("quality", "720"))
            jobs = []
            for u in urls[:50]:
                jid = new_job("download", owner=sp.uid, url=u, audio=q == "audio")
                run_job(jid, job_download, sp, u, q, sem=DL_SEM)
                jobs.append(jid)
            return self.send_json({"jobs": jobs})
        vid = data.get("id", "")
        if not VID_RE.match(vid) or not mpath(lib, vid).exists():
            return self.err("Video non trovato", 404)
        if parts == ["api", "settings"]:  # impostazioni del singolo video (velocita', salto delle pause)
            m = load_meta(lib, vid)
            st = m.get("settings") or {}
            if "speed" in data:
                st["speed"] = round(max(0.5, min(3.0, float(data["speed"]))), 2)
            if "skip" in data:
                st["skip"] = bool(data["skip"])
            m["settings"] = st
            save_meta(lib, m)
            return self.send_json({"ok": True, "settings": st})
        if parts == ["api", "archive"]:
            m = load_meta(lib, vid)
            m["archived"] = bool(data.get("archived", True))
            save_meta(lib, m)
            return self.send_json(m)
        if parts == ["api", "analyze"]:
            noise = max(-80.0, min(-5.0, float(data.get("noise", -35))))
            mind = max(0.1, min(10.0, float(data.get("min", 0.6))))
            pad = max(0.0, min(1.0, float(data.get("pad", 0.12))))
            jid = start_analyze(sp, vid, noise, mind, pad, title=load_meta(lib, vid)["title"])
            return self.send_json({"job": jid})
        if parts == ["api", "export"]:
            speed = max(0.25, min(4.0, float(data.get("speed", 1))))
            remove = bool(data.get("remove", True))
            if not remove and abs(speed - 1) < 1e-3:
                return self.err("Niente da esportare: scegli una velocita' o rimuovi i silenzi")
            m = load_meta(lib, vid)
            f = sp.free()
            if f is not None and f < (20 << 20):
                return self.err(f"Spazio esaurito: hai usato tutti i {gb(sp.quota)}. Elimina qualche video o esportazione.", 413)
            jid = new_job("export", vid, owner=sp.uid, title=m["title"])
            run_job(jid, job_export, sp, vid, round(speed, 3), remove, sem=CPU_SEM)
            return self.send_json({"job": jid})
        self.err("Non trovato", 404)

    def import_file(self, sp):
        """Upload in un'unica richiesta (versione locale / compatibilita')."""
        from urllib.parse import unquote
        name = unquote(self.headers.get("X-Filename", "video.mp4"))
        ext = Path(name).suffix.lower()
        if not FFMPEG or ext not in PLAYABLE + CONVERT:
            self.drain()
            return self.err("ffmpeg non trovato" if not FFMPEG else f"Formato {ext or 'sconosciuto'} non supportato")
        try:
            sp.need(int(self.headers.get("Content-Length") or 0) * (2 if ext in CONVERT else 1), "caricare questo file")
        except QuotaError as e:
            self.drain()
            return self.err(str(e), 413)
        vid = uuid.uuid4().hex[:10]
        d = sp.lib / vid
        d.mkdir()
        dst = d / ("video" + ext)
        try:
            with open(dst, "wb") as f:
                for chunk in self.stream():
                    f.write(chunk)
            if dst.stat().st_size == 0:
                raise RuntimeError("Il file e' arrivato vuoto")
            m = finalize(sp.lib, vid, dst, Path(name).stem, "file locale")
        except Exception as e:
            shutil.rmtree(d, ignore_errors=True)
            return self.err(str(e) or "Importazione non riuscita", 500)
        start_analyze(sp, vid, title=m["title"])
        self.send_json(m)

    # ---- upload a pezzi: POST api/upload {name,size} -> PUT api/upload/<id>?offset=N -> POST api/upload/<id>/done
    def upload_post(self, sp, rest):
        try:
            data = self.body()
        except Exception:
            return self.err("JSON non valido")
        if not rest:
            if not FFMPEG:
                return self.err("ffmpeg non trovato")
            name = str(data.get("name") or "video.mp4")[:200]
            size = int(data.get("size") or 0)
            ext = Path(name).suffix.lower()
            if ext not in PLAYABLE + CONVERT:
                return self.err(f"Formato {ext or 'sconosciuto'} non supportato")
            if size <= 0:
                return self.err("Il file e' vuoto")
            try:  # i formati da convertire occupano il doppio finche' la conversione non finisce
                sp.need(size * (2 if ext in CONVERT else 1), "caricare questo file")
            except QuotaError as e:
                return self.err(str(e), 413)
            free = shutil.disk_usage(sp.lib).free
            if size * (2 if ext in CONVERT else 1) + (200 << 20) > free:
                return self.err(f"Spazio insufficiente sul server ({free / 1e9:.1f} GB liberi)", 507)
            vid = uuid.uuid4().hex[:10]
            d = sp.lib / vid
            d.mkdir()
            title = Path(name).stem
            jid = new_job("upload", vid, owner=sp.uid, title=title)
            upd(jid, status="running", message="Caricamento 0%")
            with UP_LOCK:
                UPLOADS[vid] = {"path": d / ("video" + ext + ".part"), "ext": ext, "size": size, "got": 0, "uid": sp.uid,
                                "lib": sp.lib, "jid": jid, "title": title, "lock": threading.Lock(), "seen": time.time()}
            UPLOADS[vid]["path"].touch()
            return self.send_json({"id": vid, "job": jid})
        up = UPLOADS.get(rest[0])
        if not up or up["uid"] != sp.uid:
            return self.err("Caricamento non trovato o scaduto", 404)
        if rest[1:] == ["done"]:
            if up["got"] != up["size"]:
                return self.err(f"Caricamento incompleto ({up['got']} di {up['size']} byte)", 409)
            with UP_LOCK:
                UPLOADS.pop(rest[0], None)
            vid, jid, lib = rest[0], up["jid"], up["lib"]
            dst = up["path"].with_name("video" + up["ext"])
            os.replace(up["path"], dst)

            def work(jid):
                upd(jid, progress=0.97, message="Creo anteprima...")
                m = finalize(lib, vid, dst, up["title"], "file locale", jid)
                upd(jid, result={"video": vid}, message=m["title"])
                return m

            def worker():
                try:
                    m = work(jid)
                    upd(jid, status="done", progress=1.0, ended=time.time())
                    start_analyze(sp, vid, title=m["title"])
                except Exception as e:  # noqa
                    shutil.rmtree(lib / vid, ignore_errors=True)
                    upd(jid, status="error", message=str(e).strip()[-400:] or "Errore", ended=time.time())
            threading.Thread(target=worker, daemon=True).start()
            return self.send_json({"job": jid})
        self.err("Non trovato", 404)

    def do_PUT(self):
        if self.cross_site():
            self.drain()
            return self.err("Richiesta non consentita", 403)
        sp = self.need_space()
        if not sp:
            return
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        up = UPLOADS.get(parts[2]) if len(parts) == 3 and parts[:2] == ["api", "upload"] else None
        if not up or up["uid"] != sp.uid:
            self.drain()
            return self.err("Caricamento non trovato o scaduto", 404)
        offset = int((parse_qs(u.query).get("offset") or ["0"])[0])
        with up["lock"]:
            if offset != up["got"]:
                self.drain()
                return self.send_json({"error": "offset errato", "got": up["got"]}, 409)
            n = 0
            with open(up["path"], "r+b") as f:
                f.seek(offset); f.truncate()
                for chunk in self.stream():
                    if offset + n + len(chunk) > up["size"]:
                        chunk = chunk[:max(0, up["size"] - offset - n)]
                    f.write(chunk); n += len(chunk)
            up["got"] = offset + n
            up["seen"] = time.time()
        p = up["got"] / up["size"]
        upd(up["jid"], progress=p * 0.96,
            message=f"Caricamento {int(p * 100)}%  ·  {up['got'] / 1e6:.0f} di {up['size'] / 1e6:.0f} MB")
        self.send_json({"got": up["got"]})

    # ---- DELETE
    def do_DELETE(self):
        if self.cross_site():
            return self.err("Richiesta non consentita", 403)
        sp = self.need_space()
        if not sp:
            return
        lib = sp.lib
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if len(parts) == 3 and parts[:2] == ["api", "upload"]:
            with UP_LOCK:
                up = UPLOADS.get(parts[2])
                up = UPLOADS.pop(parts[2]) if up and up["uid"] == sp.uid else None
            if up:
                shutil.rmtree(lib / parts[2], ignore_errors=True)
                upd(up["jid"], status="error", message="Caricamento annullato", ended=time.time())
            return self.send_json({"ok": True})
        if len(parts) >= 3 and parts[:2] == ["api", "video"] and VID_RE.match(parts[2]):
            vid = parts[2]
            if len(parts) == 3:
                shutil.rmtree(lib / vid, ignore_errors=True)
                return self.send_json({"ok": True})
            if len(parts) == 5 and parts[3] == "export" and mpath(lib, vid).exists():
                m = load_meta(lib, vid)
                names = [e["file"] for e in m["exports"]]
                if parts[4] in names:
                    (lib / vid / parts[4]).unlink(missing_ok=True)
                    m["exports"] = [e for e in m["exports"] if e["file"] != parts[4]]
                    save_meta(lib, m)
                return self.send_json(m)
        self.err("Non trovato", 404)


def janitor():
    """Elimina i caricamenti fermi da piu' di un'ora (es. browser chiuso a meta')."""
    while True:
        time.sleep(600)
        now = time.time()
        with UP_LOCK:
            stale = [k for k, u in UPLOADS.items() if now - u["seen"] > 3600]
            for k in stale:
                u = UPLOADS.pop(k)
                shutil.rmtree(u["lib"] / k, ignore_errors=True)
                upd(u["jid"], status="error", message="Caricamento scaduto", ended=now)


def main():
    clean_partials()
    threading.Thread(target=janitor, daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), H)
    url = f"http://{HOST}:{PORT}"
    print(f"\n  StudyCut e' attivo su {url}\n  (chiudi questa finestra o premi Ctrl+C per uscire)\n")
    if not FFMPEG:
        print("  ATTENZIONE: ffmpeg non trovato. Esegui: pip install imageio-ffmpeg\n")
    if "--no-browser" not in sys.argv and not os.environ.get("STUDYCUT_HEADLESS"):
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

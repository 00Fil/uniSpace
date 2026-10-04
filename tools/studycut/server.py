#!/usr/bin/env python3
"""StudyCut - scarica, consulta, taglia i silenzi e cambia velocita' alle lezioni.
Gira sul tuo computer (127.0.0.1) oppure in Docker dietro il gateway StudyKit."""
import json, os, re, shutil, subprocess, sys, threading, time, uuid, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, quote, parse_qs

BASE = Path(__file__).resolve().parent
LIB = Path(os.environ.get("STUDYCUT_LIBRARY") or BASE / "library")
STATIC = BASE / "static"
LIB.mkdir(exist_ok=True)
HOST = os.environ.get("STUDYCUT_HOST", "127.0.0.1")
PORT = int(os.environ.get("STUDYCUT_PORT", "8765"))
COOKIES = os.environ.get("STUDYCUT_COOKIES")  # file cookies.txt (formato Netscape), utile su VPS
VID_RE = re.compile(r"^[a-f0-9]{10}$")
# formati che il browser riproduce cosi' come sono / formati da convertire in MP4 all'importazione
PLAYABLE = (".mp4", ".webm", ".mkv", ".mov", ".m4v", ".m4a", ".mp3", ".wav", ".opus", ".ogg", ".aac", ".flac")
CONVERT = (".avi", ".wmv", ".flv", ".mpg", ".mpeg", ".ts", ".mts", ".m2ts", ".3gp", ".wma")
UPLOADS, UP_LOCK = {}, threading.Lock()


def clean_partials():
    """All'avvio toglie le cartelle rimaste senza meta.json (upload/download interrotti)."""
    for d in LIB.iterdir():
        if d.is_dir() and VID_RE.match(d.name) and not (d / "meta.json").exists():
            shutil.rmtree(d, ignore_errors=True)


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
CPU_SEM = threading.Semaphore(2)


def new_job(kind, vid=None, **extra):
    jid = uuid.uuid4().hex[:10]
    with LOCK:
        JOBS[jid] = {"id": jid, "kind": kind, "video": vid, "status": "queued",
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


def jobs_snapshot():
    now = time.time()
    with LOCK:
        return [dict(j) for j in JOBS.values() if not j["ended"] or now - j["ended"] < 30]


# ---------------------------------------------------------------- library
def mpath(vid):
    return LIB / vid / "meta.json"


def load_meta(vid):
    return json.loads(mpath(vid).read_text("utf-8"))


def save_meta(m):
    p = mpath(m["id"])
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


def finalize(vid, path, title, source, jid=None):
    if path.suffix.lower() in CONVERT:
        path = to_mp4(path, jid)
    dur, has_video = probe(path)
    thumb = LIB / vid / "thumb.jpg"
    for ext in (".jpg", ".webp", ".png"):
        yt = LIB / vid / ("video" + ext)
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
    save_meta(m)
    return m


def library():
    out = []
    for d in LIB.iterdir():
        if d.is_dir() and (d / "meta.json").exists():
            try:
                out.append(load_meta(d.name))
            except Exception:
                pass
    return sorted(out, key=lambda m: m["created"], reverse=True)


# ---------------------------------------------------------------- download
def job_download(jid, url, quality):
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("yt-dlp non installato: esegui  pip install -U \"yt-dlp[default]\"")
    vid = uuid.uuid4().hex[:10]
    d = LIB / vid
    d.mkdir()
    upd(jid, video=vid, message="Recupero informazioni...")
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
            tot = s.get("total_bytes") or s.get("total_bytes_estimate") or 0
            done = s.get("downloaded_bytes") or 0
            sp = s.get("speed") or 0
            eta = s.get("eta")
            msg = f"Download {kind}  {done/1e6:.0f}/{tot/1e6:.0f} MB"
            if sp:
                msg += f"  ·  {sp/1e6:.1f} MB/s"
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
        m = finalize(vid, files[0], info.get("title") or "Video", url)
        upd(jid, result={"video": vid}, message=m["title"])
    except Exception as e:
        shutil.rmtree(d, ignore_errors=True)
        msg = re.sub(r"\x1b\[[0-9;]*m", "", str(e)).replace("ERROR: ", "")
        raise RuntimeError(msg)


# ---------------------------------------------------------------- silences
def job_analyze(jid, vid, noise, mind, pad):
    m = load_meta(vid)
    src, dur = LIB / vid / m["file"], m["duration"] or 1
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
    m = load_meta(vid)
    m["analysis"] = {"noise": noise, "min": mind, "pad": pad, "skips": skips,
                     "kept": max(0.0, dur - removed), "count": len(skips)}
    save_meta(m)
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


def job_export(jid, vid, speed, remove):
    m = load_meta(vid)
    src, dur = LIB / vid / m["file"], m["duration"]
    if remove and not m.get("analysis"):
        raise RuntimeError("Analizza prima i silenzi")
    keep = keep_segments(m["analysis"]["skips"], dur) if remove else [(0, dur)]
    out_dur = sum(b - a for a, b in keep) / speed
    is_audio = m.get("audio", False)
    vf, af = [], []
    if remove:
        expr = "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in keep)
        vf += [f"select='{expr}'", "setpts=N/FRAME_RATE/TB"]
        af += [f"aselect='{expr}'", "asetpts=N/SR/TB"]
    if abs(speed - 1) > 1e-3:
        vf.append(f"setpts=PTS/{speed:.5f}")
        af.append(atempo_chain(speed))
    tag = f"{speed:g}x".replace(".", ",") + ("_senza-silenzi" if remove else "")
    name = f"export_{tag}.{'m4a' if is_audio else 'mp4'}"
    out = LIB / vid / name
    tmp = LIB / vid / (name + ".part" + out.suffix)
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src)]
    if af:
        graph = f"[0:a]{','.join(af)}[a]" if is_audio else \
            f"[0:v]{','.join(vf)}[v];[0:a]{','.join(af)}[a]"
        if len(graph) > 6000:  # grafi lunghi -> file (limiti della riga di comando)
            gfile = LIB / vid / "graph.txt"
            gfile.write_text(graph, "utf-8")
            cmd += (["-/filter_complex", str(gfile)] if FF_MAJOR >= 7
                    else ["-filter_complex_script", str(gfile)])
        else:
            cmd += ["-filter_complex", graph]
        cmd += ["-map", "[a]"] if is_audio else ["-map", "[v]", "-map", "[a]"]
    if is_audio:
        cmd += ["-vn"]
    else:
        cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"]
    cmd += ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
            "-progress", "pipe:1", "-nostats", str(tmp)]
    upd(jid, message="Esportazione...")
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                         errors="ignore")
    err = []
    threading.Thread(target=lambda: err.extend(p.stderr), daemon=True).start()
    for line in p.stdout:
        if line.startswith(("out_time_us=", "out_time_ms=")):
            try:
                sec = int(line.split("=")[1]) / 1e6
                upd(jid, progress=min(0.99, sec / max(out_dur, 0.1)),
                    message=f"Esportazione  {int(min(sec/max(out_dur,.1),1)*100)}%")
            except ValueError:
                pass
    p.wait()
    if p.returncode != 0:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("ffmpeg: " + "".join(err)[-300:])
    os.replace(tmp, out)
    m = load_meta(vid)
    m["exports"] = [e for e in m.get("exports", []) if e["file"] != name]
    m["exports"].insert(0, {"file": name, "speed": speed, "remove": remove,
                            "duration": out_dur, "size": out.stat().st_size,
                            "created": time.time()})
    save_meta(m)
    upd(jid, result={"video": vid, "file": name}, message="Esportazione completata")


# ---------------------------------------------------------------- http
CTYPES = {".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
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
        if ctype.startswith(("text/html", "text/javascript", "text/css")):
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
            return self.send_json({"ffmpeg": bool(FFMPEG), "ytdlp": ver})
        if parts == ["api", "library"]:
            return self.send_json(library())
        if len(parts) == 3 and parts[:2] == ["api", "video"] and VID_RE.match(parts[2]):
            if not mpath(parts[2]).exists():
                return self.err("Video non trovato", 404)
            return self.send_json(load_meta(parts[2]))
        if parts == ["api", "jobs"]:
            return self.send_json(jobs_snapshot())
        if len(parts) == 3 and parts[:2] == ["api", "jobs"]:
            with LOCK:
                j = JOBS.get(parts[2])
                j = dict(j) if j else None
            return self.send_json(j) if j else self.err("Job non trovato", 404)
        if len(parts) == 3 and parts[0] == "media" and VID_RE.match(parts[1]):
            vid, name = parts[1], parts[2]
            if "/" in name or "\\" in name or name.startswith("."):
                return self.err("Nome non valido")
            p = LIB / vid / name
            if not p.is_file():
                return self.err("File non trovato", 404)
            dl = None
            if "dl" in parse_qs(u.query):
                title = re.sub(r'[\\/:*?"<>|]+', "_", load_meta(vid)["title"])[:120]
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
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if parts == ["api", "import"]:
            return self.import_file()
        if parts[:2] == ["api", "upload"]:
            return self.upload_post(parts[2:])
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
            q = str(data.get("quality", "720"))
            jobs = []
            for u in urls[:50]:
                jid = new_job("download", url=u, audio=q == "audio")
                run_job(jid, job_download, u, q, sem=DL_SEM)
                jobs.append(jid)
            return self.send_json({"jobs": jobs})
        vid = data.get("id", "")
        if not VID_RE.match(vid) or not mpath(vid).exists():
            return self.err("Video non trovato", 404)
        if parts == ["api", "archive"]:
            m = load_meta(vid)
            m["archived"] = bool(data.get("archived", True))
            save_meta(m)
            return self.send_json(m)
        if parts == ["api", "analyze"]:
            noise = max(-80.0, min(-5.0, float(data.get("noise", -35))))
            mind = max(0.1, min(10.0, float(data.get("min", 0.6))))
            pad = max(0.0, min(1.0, float(data.get("pad", 0.12))))
            jid = new_job("analyze", vid, title=load_meta(vid)["title"])
            run_job(jid, job_analyze, vid, noise, mind, pad, sem=CPU_SEM)
            return self.send_json({"job": jid})
        if parts == ["api", "export"]:
            speed = max(0.25, min(4.0, float(data.get("speed", 1))))
            remove = bool(data.get("remove", True))
            if not remove and abs(speed - 1) < 1e-3:
                return self.err("Niente da esportare: scegli una velocita' o rimuovi i silenzi")
            jid = new_job("export", vid, title=load_meta(vid)["title"])
            run_job(jid, job_export, vid, round(speed, 3), remove, sem=CPU_SEM)
            return self.send_json({"job": jid})
        self.err("Non trovato", 404)

    def import_file(self):
        """Upload in un'unica richiesta (versione locale / compatibilita')."""
        from urllib.parse import unquote
        name = unquote(self.headers.get("X-Filename", "video.mp4"))
        ext = Path(name).suffix.lower()
        if not FFMPEG or ext not in PLAYABLE + CONVERT:
            self.drain()
            return self.err("ffmpeg non trovato" if not FFMPEG else f"Formato {ext or 'sconosciuto'} non supportato")
        vid = uuid.uuid4().hex[:10]
        d = LIB / vid
        d.mkdir()
        dst = d / ("video" + ext)
        try:
            with open(dst, "wb") as f:
                for chunk in self.stream():
                    f.write(chunk)
            if dst.stat().st_size == 0:
                raise RuntimeError("Il file e' arrivato vuoto")
            m = finalize(vid, dst, Path(name).stem, "file locale")
        except Exception as e:
            shutil.rmtree(d, ignore_errors=True)
            return self.err(str(e) or "Importazione non riuscita", 500)
        self.send_json(m)

    # ---- upload a pezzi: POST api/upload {name,size} -> PUT api/upload/<id>?offset=N -> POST api/upload/<id>/done
    def upload_post(self, rest):
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
            free = shutil.disk_usage(LIB).free
            if size * (2 if ext in CONVERT else 1) + (200 << 20) > free:
                return self.err(f"Spazio insufficiente sul server ({free / 1e9:.1f} GB liberi)", 507)
            vid = uuid.uuid4().hex[:10]
            d = LIB / vid
            d.mkdir()
            title = Path(name).stem
            jid = new_job("upload", vid, title=title)
            upd(jid, status="running", message="Caricamento 0%")
            with UP_LOCK:
                UPLOADS[vid] = {"path": d / ("video" + ext + ".part"), "ext": ext, "size": size, "got": 0,
                                "jid": jid, "title": title, "lock": threading.Lock(), "seen": time.time()}
            UPLOADS[vid]["path"].touch()
            return self.send_json({"id": vid, "job": jid})
        up = UPLOADS.get(rest[0])
        if not up:
            return self.err("Caricamento non trovato o scaduto", 404)
        if rest[1:] == ["done"]:
            if up["got"] != up["size"]:
                return self.err(f"Caricamento incompleto ({up['got']} di {up['size']} byte)", 409)
            with UP_LOCK:
                UPLOADS.pop(rest[0], None)
            vid, jid = rest[0], up["jid"]
            dst = up["path"].with_name("video" + up["ext"])
            os.replace(up["path"], dst)

            def work(jid):
                upd(jid, progress=0.97, message="Creo anteprima...")
                m = finalize(vid, dst, up["title"], "file locale", jid)
                upd(jid, result={"video": vid}, message=m["title"])

            def worker():
                try:
                    work(jid)
                    upd(jid, status="done", progress=1.0, ended=time.time())
                except Exception as e:  # noqa
                    shutil.rmtree(LIB / vid, ignore_errors=True)
                    upd(jid, status="error", message=str(e).strip()[-400:] or "Errore", ended=time.time())
            threading.Thread(target=worker, daemon=True).start()
            return self.send_json({"job": jid})
        self.err("Non trovato", 404)

    def do_PUT(self):
        if self.cross_site():
            self.drain()
            return self.err("Richiesta non consentita", 403)
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        up = UPLOADS.get(parts[2]) if len(parts) == 3 and parts[:2] == ["api", "upload"] else None
        if not up:
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
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if len(parts) == 3 and parts[:2] == ["api", "upload"]:
            with UP_LOCK:
                up = UPLOADS.pop(parts[2], None)
            if up:
                shutil.rmtree(LIB / parts[2], ignore_errors=True)
                upd(up["jid"], status="error", message="Caricamento annullato", ended=time.time())
            return self.send_json({"ok": True})
        if len(parts) >= 3 and parts[:2] == ["api", "video"] and VID_RE.match(parts[2]):
            vid = parts[2]
            if len(parts) == 3:
                shutil.rmtree(LIB / vid, ignore_errors=True)
                return self.send_json({"ok": True})
            if len(parts) == 5 and parts[3] == "export":
                m = load_meta(vid)
                names = [e["file"] for e in m["exports"]]
                if parts[4] in names:
                    (LIB / vid / parts[4]).unlink(missing_ok=True)
                    m["exports"] = [e for e in m["exports"] if e["file"] != parts[4]]
                    save_meta(m)
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
                shutil.rmtree(LIB / k, ignore_errors=True)
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

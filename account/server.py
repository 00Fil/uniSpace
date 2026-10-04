#!/usr/bin/env python3
"""Account StudyKit: registrazione, accesso e sessioni per tutti i tool.

Il gateway (Caddy) chiede a questo servizio, a ogni richiesta, se la sessione e' valida
(forward_auth -> GET /auth/verify). Se lo e', inoltra al tool gli header:
  X-User-Id     identificativo stabile dell'utente (cartella personale: /data/users/<id>/)
  X-User-Name   nome utente
  X-User-Quota  spazio massimo in byte (uguale per tutti i tool)

Comandi da terminale (docker compose exec account python server.py ...):
  list                       elenca gli utenti
  add-user NOME              crea un utente (chiede la password)
  passwd NOME                cambia password
  quota NOME GB              cambia lo spazio di un utente (0 = valore predefinito)
  del-user NOME              elimina l'utente e le sue sessioni (i file restano)
"""
import getpass, hashlib, hmac, json, os, re, secrets, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote

BASE = Path(__file__).resolve().parent
STATIC = BASE / "static"
DB_PATH = Path(os.environ.get("ACCOUNT_DB", "/data/account.db"))
USERS_ROOT = Path(os.environ.get("USERS_ROOT", "/data/users"))
PORT = int(os.environ.get("ACCOUNT_PORT", "8000"))
QUOTA_GB = float(os.environ.get("USER_QUOTA_GB", "2"))
SIGNUP = os.environ.get("SIGNUP", "open").lower()          # open | closed
SIGNUP_CODE = os.environ.get("SIGNUP_CODE", "").strip()      # se impostato serve per registrarsi
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "30"))
COOKIE = "sk_session"
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")

# ---------------------------------------------------------------- database
_local = threading.local()


def db():
    c = getattr(_local, "c", None)
    if c is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        c = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA foreign_keys=ON")
        _local.c = c
    return c


def init_db():
    db().executescript("""
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, pw TEXT NOT NULL,
      quota INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(
      token TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created REAL NOT NULL, seen REAL NOT NULL, expires REAL NOT NULL, agent TEXT);
    CREATE INDEX IF NOT EXISTS s_uid ON sessions(uid);
    """)


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return "scrypt$" + salt.hex() + "$" + h.hex()


def check_pw(pw, stored):
    try:
        _, salt, h = stored.split("$")
        return hmac.compare_digest(hash_pw(pw, bytes.fromhex(salt)).split("$")[2], h)
    except Exception:
        return False


def quota_of(u):
    return int(u["quota"]) if u["quota"] else int(QUOTA_GB * (1 << 30))


def usage(uid):
    total, root = 0, USERS_ROOT / uid
    if root.is_dir():
        for dp, _, files in os.walk(root):
            for f in files:
                try:
                    total += os.lstat(os.path.join(dp, f)).st_size
                except OSError:
                    pass
    return total


def create_user(name, pw):
    uid = secrets.token_hex(8)
    db().execute("INSERT INTO users(id,name,pw,created) VALUES(?,?,?,?)", (uid, name, hash_pw(pw), time.time()))
    return uid


def tok_hash(t):
    return hashlib.sha256(t.encode()).hexdigest()


def new_session(uid, agent):
    t = secrets.token_urlsafe(32)
    now = time.time()
    db().execute("INSERT INTO sessions VALUES(?,?,?,?,?,?)",
                 (tok_hash(t), uid, now, now, now + SESSION_DAYS * 86400, (agent or "")[:200]))
    return t


def session_user(token):
    if not token:
        return None
    r = db().execute("SELECT u.*, s.seen, s.token AS th FROM sessions s JOIN users u ON u.id=s.uid "
                     "WHERE s.token=? AND s.expires>?", (tok_hash(token), time.time())).fetchone()
    if r and time.time() - r["seen"] > 3600:  # scadenza che scorre: si rinnova usandola
        now = time.time()
        db().execute("UPDATE sessions SET seen=?, expires=? WHERE token=?", (now, now + SESSION_DAYS * 86400, r["th"]))
    return r


# tentativi di accesso falliti: al massimo 10 ogni 15 minuti per indirizzo e per nome
FAILS, FLOCK = {}, threading.Lock()


def limited(*keys):
    now = time.time()
    with FLOCK:
        for k in keys:
            FAILS[k] = [t for t in FAILS.get(k, []) if now - t < 900]
        return any(len(FAILS[k]) >= 10 for k in keys)


def failed(*keys):
    with FLOCK:
        for k in keys:
            FAILS.setdefault(k, []).append(time.time())


# ---------------------------------------------------------------- http
CTYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
          ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml"}


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    # ---- utilità
    def send(self, code, body=b"", ctype="application/json; charset=utf-8", headers=()):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def json(self, obj, code=200, headers=()):
        self.send(code, json.dumps(obj, ensure_ascii=False).encode(), headers=headers)

    def err(self, msg, code=400):
        self.json({"error": msg}, code)

    def cookie(self):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == COOKIE:
                return v
        return None

    def secure(self):
        return (self.headers.get("X-Forwarded-Proto") or "").lower() == "https"

    def set_cookie(self, token, max_age):
        flags = f"Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}" + ("; Secure" if self.secure() else "")
        return ("Set-Cookie", f"{COOKIE}={token}; {flags}")

    def ip(self):
        return self.headers.get("X-Client-IP") or self.client_address[0]

    def body(self):
        n = min(int(self.headers.get("Content-Length") or 0), 64 * 1024)
        return json.loads(self.rfile.read(n) or b"{}")

    def same_origin(self):
        o = self.headers.get("Origin")
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or ""
        return not o or urlparse(o).netloc == host

    def static(self, name):
        p = STATIC / name
        if not p.is_file():
            return self.err("Non trovato", 404)
        self.send(200, p.read_bytes(), CTYPES.get(p.suffix, "application/octet-stream"))

    # ---- GET
    def do_GET(self):
        u = urlparse(self.path)
        path = u.path.rstrip("/") or "/"
        if path == "/auth/verify":
            return self.verify()
        if path in ("/account", "/account/login"):
            # chi ha gia' una sessione valida va direttamente dove voleva andare
            if session_user(self.cookie()):
                return self.send(302, headers=[("Location", safe_next(parse_qs(u.query).get("next", ["/"])[0]))])
            return self.static("login.html")
        m = re.match(r"^/account/([\w-]+\.(?:css|js|svg))$", path)
        if m:
            return self.static(m[1])
        if path == "/account/api/me":
            usr = session_user(self.cookie())
            if not usr:
                return self.err("Accesso richiesto", 401)
            return self.json({"id": usr["id"], "name": usr["name"], "quota": quota_of(usr), "used": usage(usr["id"]),
                              "created": usr["created"]})
        if path == "/account/api/config":
            return self.json({"signup": SIGNUP != "closed", "code": bool(SIGNUP_CODE), "quota": int(QUOTA_GB * (1 << 30))})
        if path == "/healthz":
            return self.send(200, b"ok", "text/plain")
        self.err("Non trovato", 404)

    do_HEAD = do_GET

    def verify(self):
        """forward_auth: 200 con gli header dell'utente, altrimenti login (pagine) o 401 (API)."""
        usr = session_user(self.cookie())
        if usr:
            return self.send(200, b"", "text/plain", [("X-User-Id", usr["id"]), ("X-User-Name", usr["name"]),
                                                       ("X-User-Quota", str(quota_of(usr)))])
        uri = self.headers.get("X-Forwarded-Uri") or "/"
        method = self.headers.get("X-Forwarded-Method") or "GET"
        accept = self.headers.get("Accept") or ""
        if method == "GET" and ("text/html" in accept or not accept):
            return self.send(302, headers=[("Location", "/account/login?next=" + quote(uri, safe=""))])
        self.err("Accesso richiesto: entra di nuovo", 401)

    # ---- POST
    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        if not self.same_origin():
            return self.err("Richiesta non consentita", 403)
        try:
            data = self.body()
        except Exception:
            return self.err("Richiesta non valida")
        if path == "/account/api/logout":
            t = self.cookie()
            if t:
                db().execute("DELETE FROM sessions WHERE token=?", (tok_hash(t),))
            return self.json({"ok": True}, headers=[self.set_cookie("", 0)])
        name = str(data.get("name") or "").strip().lower()
        pw = str(data.get("password") or "")
        if path == "/account/api/login":
            if limited("ip:" + self.ip(), "u:" + name):
                return self.err("Troppi tentativi: riprova tra qualche minuto", 429)
            r = db().execute("SELECT * FROM users WHERE name=?", (name,)).fetchone()
            if not r or not check_pw(pw, r["pw"]):
                if not r:
                    check_pw(pw, hash_pw("x"))  # stesso tempo anche se il nome non esiste
                failed("ip:" + self.ip(), "u:" + name)
                return self.err("Nome utente o password non corretti", 401)
            t = new_session(r["id"], self.headers.get("User-Agent"))
            return self.json({"ok": True, "name": r["name"]}, headers=[self.set_cookie(t, SESSION_DAYS * 86400)])
        if path == "/account/api/signup":
            if SIGNUP == "closed":
                return self.err("Le registrazioni sono chiuse", 403)
            if limited("ip:" + self.ip()):
                return self.err("Troppi tentativi: riprova tra qualche minuto", 429)
            if SIGNUP_CODE and not hmac.compare_digest(str(data.get("code") or "").strip(), SIGNUP_CODE):
                failed("ip:" + self.ip())
                return self.err("Codice di invito non valido", 403)
            if not NAME_RE.match(name):
                return self.err("Nome utente: da 3 a 32 caratteri tra lettere minuscole, numeri, punto, trattino e _")
            if len(pw) < 8:
                return self.err("La password deve avere almeno 8 caratteri")
            if len(pw) > 200:
                return self.err("Password troppo lunga")
            try:
                uid = create_user(name, pw)
            except sqlite3.IntegrityError:
                return self.err("Questo nome utente esiste già", 409)
            t = new_session(uid, self.headers.get("User-Agent"))
            return self.json({"ok": True, "name": name}, headers=[self.set_cookie(t, SESSION_DAYS * 86400)])
        if path == "/account/api/password":
            usr = session_user(self.cookie())
            if not usr:
                return self.err("Accesso richiesto", 401)
            if not check_pw(str(data.get("old") or ""), usr["pw"]):
                return self.err("La password attuale non è corretta", 403)
            new = str(data.get("new") or "")
            if not 8 <= len(new) <= 200:
                return self.err("La nuova password deve avere almeno 8 caratteri")
            db().execute("UPDATE users SET pw=? WHERE id=?", (hash_pw(new), usr["id"]))
            # chiude le altre sessioni
            db().execute("DELETE FROM sessions WHERE uid=? AND token<>?", (usr["id"], tok_hash(self.cookie())))
            return self.json({"ok": True})
        self.err("Non trovato", 404)


def safe_next(n):
    """Solo percorsi interni: niente redirect verso altri siti."""
    return n if n.startswith("/") and not n.startswith("//") and "\\" not in n else "/"


def janitor():
    while True:
        try:
            db().execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
        except Exception:
            pass
        time.sleep(3600)


# ---------------------------------------------------------------- comandi
def cli(args):
    init_db()
    cmd, rest = args[0], args[1:]
    if cmd == "list":
        for r in db().execute("SELECT * FROM users ORDER BY created"):
            print(f"{r['name']:<24} {usage(r['id']) / (1 << 30):6.2f} / {quota_of(r) / (1 << 30):.2f} GB   id {r['id']}")
        return
    if not rest:
        sys.exit("manca il nome utente")
    name = rest[0].lower()
    r = db().execute("SELECT * FROM users WHERE name=?", (name,)).fetchone()
    if cmd == "add-user":
        if r:
            sys.exit("esiste già")
        if not NAME_RE.match(name):
            sys.exit("nome non valido")
        pw = getpass.getpass("Password: ")
        if len(pw) < 8:
            sys.exit("almeno 8 caratteri")
        print("creato, id", create_user(name, pw))
    elif not r:
        sys.exit("utente non trovato")
    elif cmd == "passwd":
        pw = getpass.getpass("Nuova password: ")
        if len(pw) < 8:
            sys.exit("almeno 8 caratteri")
        db().execute("UPDATE users SET pw=? WHERE id=?", (hash_pw(pw), r["id"]))
        db().execute("DELETE FROM sessions WHERE uid=?", (r["id"],))
        print("fatto")
    elif cmd == "quota":
        gb = float(rest[1])
        db().execute("UPDATE users SET quota=? WHERE id=?", (int(gb * (1 << 30)), r["id"]))
        print("fatto")
    elif cmd == "del-user":
        db().execute("DELETE FROM users WHERE id=?", (r["id"],))
        print(f"eliminato. I suoi file sono in {USERS_ROOT / r['id']}")
    else:
        sys.exit(__doc__)


def main():
    if len(sys.argv) > 1:
        return cli(sys.argv[1:])
    init_db()
    threading.Thread(target=janitor, daemon=True).start()
    print(f"account: in ascolto sulla porta {PORT} · spazio per utente {QUOTA_GB:g} GB · registrazioni {SIGNUP}"
          + (" con codice" if SIGNUP_CODE else ""), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()


if __name__ == "__main__":
    main()

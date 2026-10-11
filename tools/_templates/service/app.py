"""Esempio minimo di tool con server. Il gateway lo pubblica su /__ID__/
togliendo il prefisso: qui le richieste arrivano come "/", "/api/..." ecc.
Nel frontend usa sempre percorsi relativi (fetch('api/ciao'), non '/api/ciao').
L'accesso lo controlla il gateway: ogni richiesta porta X-User-Id, X-User-Name e X-User-Quota.
I file dell'utente vanno in /data/users/<X-User-Id>/__ID__/ (volume "userdata").
/account/badge.js aggiunge il pulsante dell'account (profilo, spazio usato, Esci)."""
import json
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PAGE = b"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>__NAME__ \xc2\xb7 StudyKit</title>
<link rel="icon" href="/brand/favicon.svg"><link rel="stylesheet" href="/brand/brand.css">
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:var(--ink);color:var(--c-text);font:15px/1.5 var(--f-sans)">
<main><a class="k-logo" href="../"><b>&larr; StudyKit</b></a><h1 class="k-display" style="font-size:64px;margin:14px 0">__NAME__</h1><p id="o" class="k-mono">...</p></main>
<script>fetch('api/ciao').then(r => r.json()).then(j => o.textContent = j.msg)</script>
<script src="/account/badge.js" defer></script>"""


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        user = self.headers.get("X-User-Name")
        if not self.headers.get("X-User-Id"):
            body, ctype, code = b'{"error": "Accesso richiesto"}', "application/json", 401
        elif self.path.startswith("/api/ciao"):
            body, ctype, code = json.dumps({"msg": f"Ciao {user}, dal server!"}).encode(), "application/json", 200
        else:
            body, ctype, code = PAGE, "text/html; charset=utf-8", 200
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


ThreadingHTTPServer(("0.0.0.0", 8000), H).serve_forever()

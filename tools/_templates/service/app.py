"""Esempio minimo di tool con server. Il gateway lo pubblica su /__ID__/
togliendo il prefisso: qui le richieste arrivano come "/", "/api/..." ecc.
Nel frontend usa sempre percorsi relativi (fetch('api/ciao'), non '/api/ciao')."""
import json
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PAGE = b"""<!doctype html><meta charset="utf-8"><title>__NAME__</title>
<body style="font-family:system-ui;background:#000;color:#eee">
<p><a style="color:#a9c6ff" href="../">&larr; StudyKit</a></p><h1>__NAME__</h1><p id="o">...</p>
<script>fetch('api/ciao').then(r => r.json()).then(j => o.textContent = j.msg)</script>"""


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/ciao"):
            body, ctype = json.dumps({"msg": "Ciao dal server!"}).encode(), "application/json"
        else:
            body, ctype = PAGE, "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


ThreadingHTTPServer(("0.0.0.0", 8000), H).serve_forever()

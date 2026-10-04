#!/bin/sh
# Avvia StudyCut. yt-dlp viene aggiornato all'avvio e poi ogni YTDLP_UPDATE_HOURS ore:
# se esce una versione nuova, appena non ci sono lavori in corso il server si chiude
# e Docker lo riavvia (restart: unless-stopped) con la versione aggiornata.
set -u
ytdlp_version() { python -c "import yt_dlp; print(yt_dlp.version.__version__)" 2>/dev/null; }
update_ytdlp() { timeout 180 pip install -q --no-cache-dir -U "yt-dlp[default]" >/dev/null 2>&1; }
busy() {
  python - <<'PY' 2>/dev/null
import json, sys, urllib.request
jobs = json.load(urllib.request.urlopen("http://127.0.0.1:8765/api/jobs", timeout=5))
sys.exit(0 if any(j.get("status") in ("queued", "running") for j in jobs) else 1)
PY
}

if [ "$YTDLP_AUTO_UPDATE" = "1" ]; then
  echo "studycut: aggiorno yt-dlp..."
  update_ytdlp || echo "studycut: aggiornamento non riuscito, uso la versione installata"
fi
echo "studycut: yt-dlp $(ytdlp_version)"

python /app/server.py --no-browser &
PID=$!

if [ "$YTDLP_AUTO_UPDATE" = "1" ]; then
  (
    while sleep "$((YTDLP_UPDATE_HOURS * 3600))"; do
      before=$(ytdlp_version); update_ytdlp; after=$(ytdlp_version)
      [ "$before" = "$after" ] && continue
      echo "studycut: yt-dlp $before -> $after, riavvio appena i lavori in corso finiscono"
      while busy; do sleep 60; done
      kill "$PID"
      break
    done
  ) &
fi

wait "$PID"

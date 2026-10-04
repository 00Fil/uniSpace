#!/bin/sh
# Crea la password condivisa dai tool con "auth": true, poi avvia Caddy.
set -e
AUTH=/etc/caddy/auth.caddy
if [ -n "${HUB_PASSWORD:-}" ]; then
  HASH=$(caddy hash-password --plaintext "$HUB_PASSWORD")
  printf '(hub_auth) {\n\tbasic_auth {\n\t\t%s %s\n\t}\n}\n' "${HUB_USER:-studente}" "$HASH" > "$AUTH"
  echo "gateway: password attiva per l'utente ${HUB_USER:-studente}"
else
  printf '(hub_auth) {\n}\n' > "$AUTH"
  echo "gateway: ATTENZIONE, HUB_PASSWORD non impostata: i tool protetti sono aperti a tutti"
fi
unset HUB_PASSWORD
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

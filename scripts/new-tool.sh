#!/usr/bin/env sh
# Crea un nuovo tool dal modello.
#   ./scripts/new-tool.sh static  timer   "Timer di studio"
#   ./scripts/new-tool.sh service quiz    "Quiz dagli appunti"
set -eu
TYPE=${1:-}; ID=${2:-}; NAME=${3:-}
[ -n "$TYPE" ] && [ -n "$ID" ] && [ -n "$NAME" ] || { echo "uso: $0 static|service <id> \"Nome\""; exit 1; }
cd "$(dirname "$0")/.."
[ -d "tools/_templates/$TYPE" ] || { echo "tipo sconosciuto: $TYPE (static o service)"; exit 1; }
echo "$ID" | grep -Eq '^[a-z0-9][a-z0-9-]*$' || { echo "id non valido: solo a-z, 0-9 e -"; exit 1; }
[ ! -e "tools/$ID" ] || { echo "tools/$ID esiste già"; exit 1; }
cp -R "tools/_templates/$TYPE" "tools/$ID"
NAME_ESC=$(printf '%s' "$NAME" | sed 's/[&/\]/\\&/g')
find "tools/$ID" -type f | while read -r f; do
  sed -i.bak -e "s/__ID__/$ID/g" -e "s/__NAME__/$NAME_ESC/g" "$f" && rm -f "$f.bak"
done
echo "Creato tools/$ID"
echo "1. Modifica tools/$ID/tool.json (descrizione, categoria, icona)"
if [ "$TYPE" = service ]; then
  echo "2. Aggiungi il servizio \"$ID\" in docker-compose.yml (c'è un esempio commentato)"
  echo "3. git push e Deploy su Dokploy"
else
  echo "2. Metti i file del tool in tools/$ID/public/"
  echo "3. git push e Deploy su Dokploy"
fi

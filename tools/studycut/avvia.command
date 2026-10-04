#!/usr/bin/env bash
# macOS: doppio clic. Linux: ./avvia.command
cd "$(dirname "$0")"
if [ ! -d .venv ]; then echo "Prima installazione, un attimo..."; python3 -m venv .venv; fi
source .venv/bin/activate
python -m pip install -q --disable-pip-version-check -U -r requirements.txt
python server.py

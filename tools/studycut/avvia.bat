@echo off
title StudyCut
cd /d "%~dp0"
if not exist .venv (
  echo Prima installazione, un attimo...
  py -3 -m venv .venv 2>nul || python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install -q --disable-pip-version-check -U -r requirements.txt
python server.py
pause

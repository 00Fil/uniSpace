FROM python:3.13-slim

# ffmpeg per analisi/esportazione, tini come init, deno come runtime JS per yt-dlp (YouTube)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

RUN useradd --uid 1000 --create-home app \
 && python -m venv /opt/venv \
 && mkdir -p /app/library /app/secrets /data/users \
 && chown -R app:app /opt/venv /app /data
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STUDYCUT_HEADLESS=1 \
    STUDYCUT_HOST=0.0.0.0 \
    STUDYCUT_PORT=8765 \
    STUDYCUT_PARALLEL=3 \
    STUDYCUT_COOKIES=/app/secrets/cookies.txt \
    YTDLP_AUTO_UPDATE=1 \
    YTDLP_UPDATE_HOURS=24

WORKDIR /app
COPY --chown=app:app requirements.docker.txt ./
USER app
RUN pip install --no-cache-dir -r requirements.docker.txt
COPY --chown=app:app server.py ./
COPY --chown=app:app --chmod=755 entrypoint.sh ./
COPY --chown=app:app static/ static/

EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:8765/api/status', timeout=4)" || exit 1
ENTRYPOINT ["tini", "-g", "--", "/app/entrypoint.sh"]

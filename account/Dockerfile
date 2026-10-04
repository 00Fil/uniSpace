# Account StudyKit: login e sessioni per tutti i tool (solo libreria standard di Python)
FROM python:3.13-slim
RUN useradd --uid 1000 --create-home app \
 && mkdir -p /data/users \
 && chown -R app:app /data
ENV PYTHONUNBUFFERED=1 ACCOUNT_DB=/data/account.db USERS_ROOT=/data/users ACCOUNT_PORT=8000
WORKDIR /app
COPY --chown=app:app server.py ./
COPY --chown=app:app static/ static/
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)" || exit 1
CMD ["python", "server.py"]

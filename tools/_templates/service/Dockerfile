FROM python:3.13-slim
RUN useradd --uid 1000 --create-home app
WORKDIR /app
COPY --chown=app:app . .
USER app
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "app.py"]

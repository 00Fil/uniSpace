# Gateway: home + reverse proxy verso i tool.
# Build context = cartella principale del repository (vedi docker-compose.yml).

# 1) genera tools.json e le rotte dai file tools/*/tool.json
FROM node:22-alpine AS registry
WORKDIR /build
COPY scripts/build-registry.mjs scripts/
COPY tools/ tools/
RUN node scripts/build-registry.mjs tools dist

# 2) Caddy serve la home e inoltra /<tool>/ al container giusto
FROM caddy:2-alpine
COPY gateway/Caddyfile /etc/caddy/Caddyfile
COPY gateway/entrypoint.sh /entrypoint.sh
COPY home/ /srv/home/
COPY --from=registry /build/dist/site/tools.json /srv/home/tools.json
COPY --from=registry /build/dist/routes/ /etc/caddy/routes/
COPY --from=registry /build/dist/static/ /srv/tools/
RUN chmod +x /entrypoint.sh && rm -f /srv/home/LEGGIMI.md
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
ENTRYPOINT ["/entrypoint.sh"]

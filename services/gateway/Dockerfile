# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node services/gateway/package*.json ./
# Optional corporate/cloud CA; TLS verification remains enabled.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev
COPY --chown=node:node services/gateway/src ./src
COPY --chown=node:node services/gateway/migrations ./migrations
COPY --chown=node:node index.html mds.js icon.png /opt/trackium-ui/
COPY --chown=node:node assets/v2 /opt/trackium-ui/assets/v2/
ENV WEB_ROOT=/opt/trackium-ui
USER node
EXPOSE 8080 9000
CMD ["node", "src/server.js"]

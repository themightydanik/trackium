# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./
# Optional corporate/cloud CA; TLS verification remains enabled.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
USER node
EXPOSE 8080 9000
CMD ["node", "src/server.js"]

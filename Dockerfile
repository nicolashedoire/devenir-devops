FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
ARG APP_VERSION=0.2.0
ARG APP_REVISION=local
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node app ./app
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node db ./db
USER node
ENV HOST=0.0.0.0 PORT=3000 APP_VERSION=${APP_VERSION} APP_REVISION=${APP_REVISION}
LABEL org.opencontainers.image.source="https://github.com/nicolashedoire/devenir-devops" \
      org.opencontainers.image.title="TaskBoard — Devenir DevOps" \
      org.opencontainers.image.version=${APP_VERSION} \
      org.opencontainers.image.revision=${APP_REVISION}
EXPOSE 3000
CMD ["node", "app/server.mjs"]

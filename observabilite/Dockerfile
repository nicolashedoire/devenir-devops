FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY observabilite/package*.json ./observabilite/
RUN npm ci --prefix observabilite --omit=dev && npm cache clean --force
COPY --chown=node:node app ./app
COPY --chown=node:node scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=node:node db ./db
COPY --chown=node:node observabilite/app-observe.mjs ./observabilite/app-observe.mjs
USER node
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "observabilite/app-observe.mjs"]

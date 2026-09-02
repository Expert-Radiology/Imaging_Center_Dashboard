# syntax=docker/dockerfile:1

# One image, two entrypoints: the web container runs `server.js`, the hourly
# Container Apps job runs `refresh-job.js`. Same code, same build, so the job
# can never normalize differently from what the site serves.

FROM node:20-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY shared ./shared
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:20-alpine AS api
WORKDIR /build
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci
COPY shared ./shared
COPY api ./api
RUN cd api && npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=api /build/api/dist ./dist
COPY --from=frontend /build/dist ./public

ENV STATIC_ROOT=/app/public
ENV PORT=8080
EXPOSE 8080

# Never run as root; Container Apps does not require it and the image has no
# reason to write anywhere.
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/api/src/server.js"]

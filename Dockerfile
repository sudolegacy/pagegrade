# syntax=docker/dockerfile:1.7
# PageGrade: Next.js web server + review worker + SQLite, in one container.
# Build:  docker build --build-arg APP_URL=https://your-domain -t pagegrade .
# Run:    docker run -p 3000:3000 -v pagegrade-data:/data --env-file .env pagegrade

ARG NODE_VERSION=22

# ---------------------------------------------------------------- build
FROM node:${NODE_VERSION}-bookworm AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Public values are baked into the site at build time (Railway passes service
# variables to declared build args automatically).
ARG APP_URL=http://localhost:3000
ARG SUPPORT_EMAIL=pagegrade1@gmail.com
ARG COMPANY_NUMBER=
ARG COMPANY_ADDRESS=
ENV APP_URL=$APP_URL SUPPORT_EMAIL=$SUPPORT_EMAIL COMPANY_NUMBER=$COMPANY_NUMBER COMPANY_ADDRESS=$COMPANY_ADDRESS
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------- runtime
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATA_DIR=/data \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CHROMIUM_PATH=/usr/local/bin/chromium
WORKDIR /app

# Chromium (the build Playwright is tested against) with its system libraries,
# plus fonts so pages in most scripts and emoji render like they do for visitors.
COPY --from=build /app/node_modules/playwright-core ./node_modules/playwright-core
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates fonts-liberation2 fonts-noto-core fonts-noto-color-emoji tini util-linux \
 && node node_modules/playwright-core/cli.js install --with-deps chromium \
 && ln -s "$(find /ms-playwright -type f -name chrome -path '*chrome-linux*' | head -n 1)" /usr/local/bin/chromium \
 && /usr/local/bin/chromium --version \
 && rm -rf /var/lib/apt/lists/* /tmp/*

RUN groupadd --system --gid 1001 pagegrade && useradd --system --uid 1001 --gid pagegrade --home /app pagegrade \
 && mkdir -p /data && chown pagegrade:pagegrade /data

COPY --from=build --chown=pagegrade:pagegrade /app/node_modules ./node_modules
COPY --from=build --chown=pagegrade:pagegrade /app/.next ./.next
COPY --from=build --chown=pagegrade:pagegrade /app/dist ./dist
COPY --from=build --chown=pagegrade:pagegrade /app/public ./public
COPY --from=build --chown=pagegrade:pagegrade /app/package.json /app/next.config.mjs ./
COPY --from=build --chown=pagegrade:pagegrade /app/scripts ./scripts

VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Starts as root only to take ownership of the mounted volume, then drops to the
# unprivileged pagegrade user (see scripts/entrypoint.sh).
ENTRYPOINT ["/usr/bin/tini", "--", "/app/scripts/entrypoint.sh"]

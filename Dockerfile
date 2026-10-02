# FDRHS Robotics Hub — one container: Next.js app + SQLite database + uploads on a persistent disk at /app/data
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
 && npm prune --omit=dev \
 && rm -rf .next/cache

FROM base AS run
# g++ lets "Compile" run a real C++ syntax check against the VEX V5 API (without it, the built-in checker is used)
ARG INSTALL_GXX=1
RUN if [ "$INSTALL_GXX" = "1" ]; then apt-get update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*; fi
ENV NODE_ENV=production \
    PORT=3000 \
    SEED_SCENARIO=clean \
    DATABASE_URL=file:./data/fdrhs.db \
    UPLOAD_DIR=./data/uploads
COPY --from=build /app /app
RUN mkdir -p /app/data
EXPOSE 3000
# migrate + first-run setup, then serve. Mount a persistent disk at /app/data or everything resets on redeploy.
CMD ["sh", "-c", "node_modules/.bin/tsx --conditions=react-server scripts/setup.ts && exec node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]

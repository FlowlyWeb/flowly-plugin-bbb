FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Optional, the GIF picker is disabled without it
ARG GIPHY_API_KEY=

# Keep placeholders in the bundles, entrypoint.sh fills them at container startup
ENV USE_RUNTIME_CONFIG=true
RUN pnpm build:all

# --- Production image (static files served by nginx) ---
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist-3.1 /usr/share/nginx/html/3.1
COPY --from=builder /app/dist-3.0 /usr/share/nginx/html/3.0
COPY entrypoint.sh /docker-entrypoint.d/40-flowly-plugin.sh

RUN chmod +x /docker-entrypoint.d/40-flowly-plugin.sh

EXPOSE 80

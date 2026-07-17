# syntax=docker/dockerfile:1.6
# ═════════════════════════════════════════════════════════════════════════════
# Frontend Dockerfile — multi-stage: Node build → Nginx static serve.
#
# Build args:
#   VITE_API_URL   baked into dist/ at build time. Required — there is no
#                  runtime config mechanism for the SPA.
#
# Example:
#   docker build --build-arg VITE_API_URL=https://api.example.com \
#                -t sku-forecasting-web .
# ═════════════════════════════════════════════════════════════════════════════

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
# Use --ignore-scripts to defuse supply-chain postinstall surprises.
RUN npm ci --ignore-scripts

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ── Stage 2: nginx ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
RUN apk add --no-cache gettext tini

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/app.conf.template            /etc/nginx/templates/app.conf.template
COPY nginx/sprosly.conf.template        /etc/nginx/templates/sprosly.conf.template
COPY nginx/legacy-redirect.conf.template /etc/nginx/templates/legacy-redirect.conf.template
COPY nginx/entrypoint.sh     /entrypoint.sh
RUN  chmod +x /entrypoint.sh

# Remove the default nginx.conf server block by writing our own top-level
# conf. We don't ship a custom nginx.conf here because the frontend has
# no rate-limit zones / upstreams — the stock config is fine once the
# default.conf in /etc/nginx/conf.d/ is replaced at runtime.
RUN rm -f /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/nginx-healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]

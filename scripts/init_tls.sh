#!/bin/sh
# Bootstrap Let's Encrypt cert for the frontend VPS.
# See ../backend/scripts/init_tls.sh for annotated flow; this is the
# same thing scoped to ${WEB_DOMAIN}.
set -eu

: "${WEB_DOMAIN:?missing}"
: "${CERTBOT_EMAIL:?missing}"
CERTBOT_STAGING="${CERTBOT_STAGING:-0}"

FRONT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FRONT_DIR"

STAGING_FLAG=""
if [ "$CERTBOT_STAGING" = "1" ]; then
    STAGING_FLAG="--staging"
    echo "[init_tls] USING LE STAGING CA"
fi

docker compose -f docker-compose.prod.yml run --rm --no-deps \
    --entrypoint /bin/sh certbot -c 'mkdir -p /var/www/certbot/.well-known/acme-challenge'

docker compose -f docker-compose.prod.yml run --rm --no-deps \
    --entrypoint certbot certbot \
    certonly \
      --webroot \
      --webroot-path /var/www/certbot \
      --email "$CERTBOT_EMAIL" \
      --agree-tos --no-eff-email \
      -d "$WEB_DOMAIN" \
      --non-interactive \
      $STAGING_FLAG

docker compose -f docker-compose.prod.yml kill -s HUP web || \
    docker compose -f docker-compose.prod.yml restart web

echo "[init_tls] done — https://$WEB_DOMAIN should now respond"

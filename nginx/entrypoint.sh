#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Рендер nginx-конфигов из шаблонов по наличию сертификатов.
#
# Легаси-режим (NEW_DOMAIN пуст) — поведение ДО MIGR-1, байт-в-байт:
# только ${WEB_DOMAIN} (app.conf либо ACME-bootstrap до первого серта).
#
# MIGR-1 (#424), NEW_DOMAIN задан:
#   • есть серт NEW_DOMAIN  → sprosly.conf (apex+www+news+help);
#   • нет серта             → его хосты добавляются в ACME-bootstrap:80,
#     чтобы certbot мог пройти http-01 (сквозь CF-proxy);
#   • LEGACY_REDIRECT=1     → app.conf легаси-домена заменяется
#     legacy-redirect.conf (постраничный 301) — Фаза 2 переключения.
# Пере-рендер каждые 6ч (подхват выпущенных/продлённых сертов) + reload.
# ─────────────────────────────────────────────────────────────────────────────
set -eu
: "${WEB_DOMAIN:?WEB_DOMAIN must be set}"
: "${CSP_CONNECT_SRC:=*}"
: "${NEW_DOMAIN:=}"
: "${LEGACY_REDIRECT:=0}"

TPL=/etc/nginx/templates
OUT=/etc/nginx/conf.d
VARS='${WEB_DOMAIN} ${NEW_DOMAIN} ${CSP_CONNECT_SRC}'

has_cert() {
    [ -f "/etc/letsencrypt/live/$1/fullchain.pem" ]
}

render_all() {
    bootstrap_hosts=""

    # ── легаси-домен ────────────────────────────────────────────────
    if has_cert "${WEB_DOMAIN}"; then
        if [ "${LEGACY_REDIRECT}" = "1" ] && [ -n "${NEW_DOMAIN}" ]; then
            envsubst "$VARS" < "$TPL/legacy-redirect.conf.template" > "$OUT/app.conf"
        else
            envsubst "$VARS" < "$TPL/app.conf.template" > "$OUT/app.conf"
        fi
    else
        bootstrap_hosts="${bootstrap_hosts} ${WEB_DOMAIN}"
        rm -f "$OUT/app.conf"
    fi

    # ── новый домен (+поддомены) ────────────────────────────────────
    if [ -n "${NEW_DOMAIN}" ]; then
        if has_cert "${NEW_DOMAIN}"; then
            envsubst "$VARS" < "$TPL/sprosly.conf.template" > "$OUT/sprosly.conf"
        else
            bootstrap_hosts="${bootstrap_hosts} ${NEW_DOMAIN} www.${NEW_DOMAIN} news.${NEW_DOMAIN} help.${NEW_DOMAIN}"
            rm -f "$OUT/sprosly.conf"
        fi
    else
        rm -f "$OUT/sprosly.conf"
    fi

    # ── ACME-bootstrap для хостов без сертификата ───────────────────
    if [ -n "${bootstrap_hosts}" ]; then
        cat > "$OUT/bootstrap.conf" <<EOF
server {
    listen 80;
    server_name${bootstrap_hosts};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }
    location = /nginx-healthz {
        access_log off;
        return 200 "ok\n";
    }
    location / { return 503; }
}
EOF
    else
        rm -f "$OUT/bootstrap.conf"
    fi
}

render_all

(
    while :; do
        sleep 21600
        render_all
        nginx -s reload 2>/dev/null || true
    done
) &

exec nginx -g 'daemon off;'

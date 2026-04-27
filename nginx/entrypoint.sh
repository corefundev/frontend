#!/bin/sh
set -eu
: "${WEB_DOMAIN:?WEB_DOMAIN must be set}"
: "${CSP_CONNECT_SRC:=*}"

if [ ! -f "/etc/letsencrypt/live/${WEB_DOMAIN}/fullchain.pem" ]; then
    cat > /etc/nginx/conf.d/bootstrap.conf <<EOF
server {
    listen 80;
    server_name ${WEB_DOMAIN};
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
    envsubst '${WEB_DOMAIN} ${CSP_CONNECT_SRC}' \
        < /etc/nginx/templates/app.conf.template \
        > /etc/nginx/conf.d/app.conf
    rm -f /etc/nginx/conf.d/bootstrap.conf
fi

(
    while :; do
        sleep 21600
        if [ -f "/etc/letsencrypt/live/${WEB_DOMAIN}/fullchain.pem" ]; then
            if [ ! -f /etc/nginx/conf.d/app.conf ]; then
                envsubst '${WEB_DOMAIN} ${CSP_CONNECT_SRC}' \
                    < /etc/nginx/templates/app.conf.template \
                    > /etc/nginx/conf.d/app.conf
                rm -f /etc/nginx/conf.d/bootstrap.conf
            fi
            nginx -s reload 2>/dev/null || true
        fi
    done
) &

exec nginx -g 'daemon off;'

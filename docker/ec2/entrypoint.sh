#!/bin/sh
set -eu
: "${PUBLIC_HOST:?required}"
case "$PUBLIC_HOST" in *[!a-z0-9.-]*|'') echo 'Invalid hostname' >&2; exit 1 ;; esac
case "${TLS_ENABLED:-false}" in
  false) template=/etc/nexoguard/bootstrap.conf.template ;;
  true)
    test -r /run/internal-tls/ca.pem
    test -r "/etc/letsencrypt/live/$PUBLIC_HOST/fullchain.pem"
    test -r "/etc/letsencrypt/live/$PUBLIC_HOST/privkey.pem"
    template=/etc/nexoguard/tls.conf.template ;;
  *) echo 'Invalid TLS mode' >&2; exit 1 ;;
esac
envsubst '${PUBLIC_HOST}' < "$template" > /tmp/nexoguard-server.conf
cat > /tmp/nexoguard-nginx.conf <<'CONF'
user nginx;
worker_processes 2;
pid /tmp/nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  server_tokens off;
  client_max_body_size 16k;
  client_body_timeout 10s;
  client_header_timeout 10s;
  send_timeout 15s;
  include /tmp/nexoguard-server.conf;
}
CONF
nginx -t -c /tmp/nexoguard-nginx.conf
exec nginx -c /tmp/nexoguard-nginx.conf -g 'daemon off;'

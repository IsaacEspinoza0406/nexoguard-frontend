#!/bin/sh
set -eu
: "${PORT:?PORT required}" "${PUBLIC_HOST:?PUBLIC_HOST required}" "${FRONT_HOST:?FRONT_HOST required}" "${BACK_HOST:?BACK_HOST required}"
case "$PORT" in *[!0-9]*|'') exit 1 ;; esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ]
for host in "$PUBLIC_HOST" "$FRONT_HOST" "$BACK_HOST"; do
  case "$host" in *[!a-zA-Z0-9.-]*|'') echo 'Invalid hostname' >&2; exit 1 ;; esac
done
export DNS_RESOLVER=$(awk '/^nameserver / { print $2; exit }' /etc/resolv.conf)
case "$DNS_RESOLVER" in *:*) export DNS_RESOLVER="[$DNS_RESOLVER]" ;; esac
envsubst '${PORT} ${PUBLIC_HOST} ${FRONT_HOST} ${BACK_HOST} ${DNS_RESOLVER}' < /etc/nginx/nexoguard.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'

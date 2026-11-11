#!/bin/sh
# Container entrypoint: make sure the data volume belongs to the app user, then
# run the web server and worker (scripts/start.mjs) without root privileges.
set -eu
DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
if [ "$(id -u)" = "0" ]; then
  # Platform volumes are usually mounted root-owned; only fix what needs fixing.
  find "$DATA_DIR" ! -user pagegrade -exec chown pagegrade:pagegrade {} + 2>/dev/null || true
  exec setpriv --reuid=pagegrade --regid=pagegrade --init-groups node /app/scripts/start.mjs
fi
exec node /app/scripts/start.mjs

#!/bin/sh
set -e
# Volume nomeado em /usr/src/app/logs costuma vir como root:root; o app roda como user node.
mkdir -p /usr/src/app/logs
chown -R node:node /usr/src/app/logs
exec su-exec node "$@"

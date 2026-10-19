#!/bin/sh
# Servidor fraco: carrega as imagens prontas e sobe tudo. NÃO compila nada.
# Pré: oss-deploy.tar + docker-compose.deploy.yml + .env no diretório ATUAL.
# Uso: cd /opt/oss && sh deploy-load.sh
set -e

TAR=oss-deploy.tar
COMPOSE=docker-compose.deploy.yml

[ -f "$TAR" ]     || { echo "faltou $TAR"; exit 1; }
[ -f "$COMPOSE" ] || { echo "faltou $COMPOSE"; exit 1; }
[ -f .env ]       || { echo "faltou .env (JWT_SECRET, DB_*)"; exit 1; }

echo "==> docker load $TAR (api + web + redis)"
docker load -i "$TAR"

echo "==> up (redis + api + web)"
docker compose -f "$COMPOSE" up -d

echo "==> aguardando api ficar healthy"
for i in $(seq 1 30); do
  s=$(docker inspect -f '{{.State.Health.Status}}' oss_api 2>/dev/null || echo starting)
  [ "$s" = healthy ] && break
  sleep 3
done

echo "==> migrate"
docker compose -f "$COMPOSE" exec -T api npm run db:migrate

echo "OK -> app em http://<SERVIDOR>:${WEB_PORT:-4000}"

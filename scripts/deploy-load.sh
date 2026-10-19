#!/bin/sh
# Servidor fraco: carrega a imagem pronta e sobe. NÃO compila nada.
# Pré: oss-deploy.tar + docker-compose.deploy.yml + .env no mesmo dir.
# Uso: sh scripts/deploy-load.sh   (rode a partir da raiz do projeto)
set -e
cd "$(dirname "$0")/.."

TAR=oss-deploy.tar
COMPOSE=docker-compose.deploy.yml

[ -f "$TAR" ] || { echo "faltou $TAR"; exit 1; }
[ -f .env ]   || { echo "faltou .env (JWT_SECRET, DB_*)"; exit 1; }

echo "==> docker load $TAR"
docker load -i "$TAR"

echo "==> up"
docker compose -f "$COMPOSE" up -d

echo "==> aguardando app ficar healthy"
for i in $(seq 1 30); do
  s=$(docker inspect -f '{{.State.Health.Status}}' oss_app 2>/dev/null || echo starting)
  [ "$s" = healthy ] && break
  sleep 3
done

echo "==> migrate"
docker compose -f "$COMPOSE" exec -T app npm run db:migrate

echo "OK"

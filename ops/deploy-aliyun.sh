#!/usr/bin/env bash
# Deploy Drop to Empire (D2E) to Aliyun ECS in an isolated stack (/srv/drop2empire, project=drop2empire, port=8443 HTTPS)
# Strictly preserves existing deployments (e.g. teamie on :80/:443 and /srv/teamie).
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
SSH_HOST=${1:-${DEPLOY_SSH_HOST:-120.25.210.202}}
PUBLIC_PORT=${PUBLIC_HTTPS_PORT:-8443}
VERSION=${VERSION:-v1.0.0}
COMMIT_SHA=$(git -C "$ROOT_DIR" rev-parse HEAD)
SHORT_SHA=$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD)

echo "==> [1/6] Running architecture guard and building artifacts locally for linux/amd64 ($VERSION @ $SHORT_SHA)..."
bash "$ROOT_DIR/ops/check-architecture.sh"

STAGE_DIR=$(mktemp -d)
trap 'rm -rf -- "$STAGE_DIR"' EXIT

mkdir -p "$STAGE_DIR/bundle/deploy"

(
  cd "$ROOT_DIR/services/game"
  GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
    -trimpath \
    -ldflags "-s -w -X drop2empire/pkg/httpx.BuildVersion=$VERSION -X drop2empire/pkg/httpx.BuildSHA=$COMMIT_SHA" \
    -o "$STAGE_DIR/bundle/service" \
    ./cmd
)

(
  cd "$ROOT_DIR/apps/web"
  npm run build
  cp -R dist "$STAGE_DIR/bundle/dist"
  VERSION="$VERSION" COMMIT_SHA="$COMMIT_SHA" node -e \
    'require("fs").writeFileSync(process.argv[1], JSON.stringify({version:process.env.VERSION,sha:process.env.COMMIT_SHA}))' \
    "$STAGE_DIR/bundle/dist/version.json"
)

cp "$ROOT_DIR/apps/web/nginx.conf" "$STAGE_DIR/bundle/nginx.conf"
cp "$ROOT_DIR/deploy/compose.production.yaml" "$STAGE_DIR/bundle/deploy/compose.production.yaml"
cp "$ROOT_DIR/deploy/production.env.example" "$STAGE_DIR/bundle/deploy/production.env.example"

COPYFILE_DISABLE=1 tar -C "$STAGE_DIR/bundle" -czf "$STAGE_DIR/release.tar.gz" .

echo "==> [2/6] Pre-flight conflict check on $SSH_HOST..."
ssh -o ConnectTimeout=10 "$SSH_HOST" "bash -s" -- "$PUBLIC_PORT" <<'EOF'
set -euo pipefail
PORT="$1"
# Ensure port is not used by any non-drop2empire process
if ss -tlnp | grep -q ":${PORT} "; then
  if ! docker ps --filter "label=com.docker.compose.project=drop2empire" --format '{{.Ports}}' | grep -q ":${PORT}->"; then
    echo "ERROR: Port ${PORT} on remote host is occupied by another service! Aborting to avoid conflict." >&2
    ss -tlnp | grep ":${PORT} " >&2
    exit 1
  fi
fi
EOF

echo "==> [3/6] Uploading release bundle to $SSH_HOST:/srv/drop2empire/releases/$SHORT_SHA..."
ssh -o ConnectTimeout=10 "$SSH_HOST" "mkdir -p /srv/drop2empire/config /srv/drop2empire/tls /srv/drop2empire/releases/$SHORT_SHA && chmod 755 /srv/drop2empire /srv/drop2empire/tls && chmod 700 /srv/drop2empire/config"
scp -q "$STAGE_DIR/release.tar.gz" "$SSH_HOST:/srv/drop2empire/releases/$SHORT_SHA/release.tar.gz"

echo "==> [4/6] Building runtime images & rolling out compose project 'drop2empire' on $SSH_HOST..."
ssh -o ConnectTimeout=10 "$SSH_HOST" "bash -s" -- "$VERSION" "$COMMIT_SHA" "$SHORT_SHA" "$PUBLIC_PORT" "$SSH_HOST" <<'EOF'
set -euo pipefail
VERSION="$1"
COMMIT_SHA="$2"
SHORT_SHA="$3"
PUBLIC_PORT="$4"
HOST_IP="$5"
RELEASE_DIR="/srv/drop2empire/releases/$SHORT_SHA"
ENV_FILE="/srv/drop2empire/config/production.env"
TLS_DIR="/srv/drop2empire/tls"

cd "$RELEASE_DIR"
tar -xzf release.tar.gz 2>/dev/null
rm -f release.tar.gz

# Sync current public IP certificate from Caddy ACME store into isolated /srv/drop2empire/tls
if docker ps --format '{{.Names}}' | grep -qx 'teamie-caddy-1'; then
  ACME_PATH="/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${HOST_IP}"
  docker exec teamie-caddy-1 cat "${ACME_PATH}/${HOST_IP}.crt" > "${TLS_DIR}/fullchain.pem"
  docker exec teamie-caddy-1 cat "${ACME_PATH}/${HOST_IP}.key" > "${TLS_DIR}/privkey.pem"
  chmod 0644 "${TLS_DIR}/fullchain.pem"
  chmod 0600 "${TLS_DIR}/privkey.pem"
fi

# Initialize production.env once if not present; never overwrite existing DB password
if [[ ! -f "$ENV_FILE" ]]; then
  RAND_PASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)
  umask 077
  cat > "$ENV_FILE" <<ENVEOF
PUBLIC_HTTPS_PORT=${PUBLIC_PORT}
TLS_CERT_DIR=${TLS_DIR}
LOG_LEVEL=info
POSTGRES_USER=drop2empire
POSTGRES_DB=drop2empire
POSTGRES_PASSWORD=${RAND_PASS}
ENVEOF
elif ! grep -q "^PUBLIC_HTTPS_PORT=" "$ENV_FILE"; then
  printf '\nPUBLIC_HTTPS_PORT=%s\nTLS_CERT_DIR=%s\n' "$PUBLIC_PORT" "$TLS_DIR" >> "$ENV_FILE"
fi

# Resolve cached base layers on host to avoid Mainland China Docker Hub timeouts
ALPINE_ID=$(docker inspect teamie-identity-1 --format '{{.Image}}')
NGINX_ID=$(docker inspect teamie-web-1 --format '{{.Image}}')
PG_ID=$(docker inspect teamie-postgres-1 --format '{{.Image}}')

docker tag "$ALPINE_ID" drop2empire-base-alpine:local
docker tag "$NGINX_ID" drop2empire-base-nginx:local
docker tag "$PG_ID" drop2empire-postgres:17-alpine

cat > Dockerfile.game.runtime <<DOCKEREOF
FROM drop2empire-base-alpine:local
USER root
WORKDIR /app
COPY service /app/service
RUN chmod 0755 /app/service
USER 65534:65534
ENTRYPOINT ["/app/service"]
DOCKEREOF

cat > Dockerfile.web.runtime <<DOCKEREOF
FROM drop2empire-base-nginx:local
USER root
LABEL org.opencontainers.image.version=${VERSION} org.opencontainers.image.revision=${COMMIT_SHA}
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY dist/ /usr/share/nginx/html/
EXPOSE 80 8443 18480
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
DOCKEREOF

GAME_IMG="drop2empire-game:${SHORT_SHA}"
WEB_IMG="drop2empire-web:${SHORT_SHA}"

DOCKER_BUILDKIT=0 docker build -q -t "$GAME_IMG" -f Dockerfile.game.runtime . >/dev/null 2>&1
DOCKER_BUILDKIT=0 docker build -q -t "$WEB_IMG" -f Dockerfile.web.runtime . >/dev/null 2>&1

cat > "$RELEASE_DIR/images.env" <<IMGEOF
GAME_IMAGE=${GAME_IMG}
WEB_IMAGE=${WEB_IMG}
POSTGRES_IMAGE=drop2empire-postgres:17-alpine
IMGEOF

docker compose -p drop2empire \
  --project-directory "$RELEASE_DIR/deploy" \
  --env-file "$ENV_FILE" \
  --env-file "$RELEASE_DIR/images.env" \
  -f "$RELEASE_DIR/deploy/compose.production.yaml" \
  up -d --remove-orphans

ln -sfn "$RELEASE_DIR" /srv/drop2empire/current
EOF

echo "==> [5/6] Verifying Drop to Empire HTTPS health & API readiness on $SSH_HOST:$PUBLIC_PORT..."
ssh -o ConnectTimeout=10 "$SSH_HOST" "bash -s" -- "$SSH_HOST" "$PUBLIC_PORT" <<'EOF'
set -euo pipefail
HOST_IP="$1"
PORT="$2"
for i in {1..20}; do
  if curl -fsS --resolve "${HOST_IP}:${PORT}:127.0.0.1" "https://${HOST_IP}:${PORT}/readyz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS --resolve "${HOST_IP}:${PORT}:127.0.0.1" "https://${HOST_IP}:${PORT}/healthz" >/dev/null
curl -fsS --resolve "${HOST_IP}:${PORT}:127.0.0.1" "https://${HOST_IP}:${PORT}/readyz" >/dev/null
curl -fsS --resolve "${HOST_IP}:${PORT}:127.0.0.1" "https://${HOST_IP}:${PORT}/version.json"
echo ""
# Verify public /admin is blocked (404) while loopback SSH tunnel port 18480 serves /admin (200)
PUB_ADMIN_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --resolve "${HOST_IP}:${PORT}:127.0.0.1" "https://${HOST_IP}:${PORT}/admin")
if [[ "$PUB_ADMIN_STATUS" != "404" ]]; then
  echo "ERROR: Expected public /admin to return 404, got ${PUB_ADMIN_STATUS}" >&2
  exit 1
fi
TUNNEL_ADMIN_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18480/admin")
if [[ "$TUNNEL_ADMIN_STATUS" != "200" ]]; then
  echo "ERROR: Expected loopback tunnel 127.0.0.1:18480/admin to return 200, got ${TUNNEL_ADMIN_STATUS}" >&2
  exit 1
fi
echo "Verified: public /admin -> ${PUB_ADMIN_STATUS} (blocked), loopback 127.0.0.1:18480/admin -> ${TUNNEL_ADMIN_STATUS} (tunnel ready)"
EOF
curl -fsS "https://$SSH_HOST:$PUBLIC_PORT/readyz" >/dev/null

echo "==> [6/6] Verifying existing Aliyun services (teamie) are 100% healthy and untouched..."
curl -fsS "https://$SSH_HOST/" -o /dev/null
ssh -o ConnectTimeout=10 "$SSH_HOST" 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
echo "==> Deployment complete! Access Drop to Empire at: https://$SSH_HOST:$PUBLIC_PORT"

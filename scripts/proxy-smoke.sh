#!/usr/bin/env bash
# Disposable, local-only smoke test. Never contacts AMD or a deployed service.
set -euo pipefail
name="elo-proxy-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-0}"
network="$name-net"
api="$name-api"
web="$name-web"
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then
    docker logs "$api" 2>/dev/null || true
    docker logs "$web" 2>/dev/null || true
  fi
  docker rm -f "$web" "$api" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
# Explicit addresses ensure API recreation really changes its Docker DNS answer.
docker network create --subnet 172.30.246.0/24 "$network" >/dev/null
start_api() {
  docker run -d --name "$api" --network "$network" --network-alias api \
    --ip "$1" -e ELO_INFERENCE_MODE=mock -e ELO_DB_PATH=/tmp/smoke.db \
    elo-demo-api:smoke >/dev/null
}
start_api 172.30.246.10
docker run -d --name "$web" --network "$network" \
  -p 127.0.0.1::80 elo-demo-web:smoke >/dev/null
docker exec "$web" nginx -t
port=$(docker port "$web" 80/tcp | cut -d: -f2)
url="http://127.0.0.1:$port"
wait_health() {
  for attempt in $(seq 1 45); do
    if curl --fail --silent --max-time 3 "$url/api/health" > /tmp/elo-proxy-health.json; then
      python3 -c 'import json; d=json.load(open("/tmp/elo-proxy-health.json")); assert d["status"] == "ok" and d["mode"] == "mock"'
      return
    fi
    sleep 1
  done
  echo 'API proxy did not become healthy' >&2
  return 1
}
wait_health
curl --fail --silent "$url/" | grep -qi '<!doctype html>'
# A real synthetic write exercises body forwarding and /api prefix removal.
curl --fail --silent -X POST "$url/api/sessions" \
  -H 'Content-Type: application/json' \
  --data '{"case_id":"proxy_smoke_synthetic","notes":"Synthetic child practiced a fictional play activity; no real clinical data.","duration_minutes":40}' \
  > /tmp/elo-proxy-session.json
session=$(python3 -c 'import json; d=json.load(open("/tmp/elo-proxy-session.json")); assert d["duration_minutes"] == 40 and d["status"] == "draft"; print(d["id"])')
curl --fail --silent "$url/api/sessions/$session" | python3 -c 'import json,sys; assert json.load(sys.stdin)["case_id"] == "proxy_smoke_synthetic"'
web_id=$(docker inspect --format '{{.Id}}' "$web")
docker rm -f "$api" >/dev/null
start_api 172.30.246.11
wait_health
# Nginx must recover without restarting the web container.
test "$web_id" = "$(docker inspect --format '{{.Id}}' "$web")"
echo 'PASS: static web, proxied GET/POST and Docker DNS IP-change recovery'

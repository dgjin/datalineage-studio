#!/usr/bin/env bash
# Batch 6 HA verification: two backend instances behind the nginx gateway.
#   1. compose config validation        2. dual instance health UP
#   3. SPA + API through nginx          4. JWT issued via gateway works on both
#   5. stop one backend -> requests keep succeeding (failover)
# Evidence is tee'd to screenshots/b6-ha-report.txt
set -u
cd "$(dirname "$0")/.."
REPORT=screenshots/b6-ha-report.txt
GATE=http://localhost:8088
TOKEN=""

code() { curl -s -o /dev/null --max-time 10 -w "%{http_code}" "$@"; }
authed() { curl -s -o /dev/null --max-time 10 -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$@"; }
health() { docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null; }
wait_healthy() {
  for _ in $(seq 1 24); do
    if [ "$(health "$1")" = "healthy" ]; then return 0; fi
    sleep 5
  done
  return 1
}

{
  echo "================================================================================"
  echo "Batch 6 HA verification - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "================================================================================"
  echo
  echo "[1] docker-compose config validation"
  docker-compose -f docker-compose.ha.yml config --quiet && echo "  compose config: OK"
  echo
  echo "[2] Dual instance health (docker inspect)"
  echo "  backend-1: $(health datalineage-backend-ha-1)"
  echo "  backend-2: $(health datalineage-backend-ha-2)"
  echo
  echo "[3] Through nginx gateway (frontend :8088)"
  echo "  GET /                             -> $(code $GATE/)"
  echo "  GET /healthz                      -> $(code $GATE/healthz)"
  for i in 1 2 3 4; do
    echo "  GET /api/v1/actuator/health #$i    -> $(code $GATE/api/v1/actuator/health)"
  done
  echo
  echo "[4] Login via gateway, then authenticated API"
  echo "    (plan example /dashboard/summary does not exist; using the real"
  echo "     endpoints DashboardController exposes: /dashboard/overview, /assets)"
  TOKEN=$(curl -s --max-time 10 -X POST "$GATE/api/v1/auth/login" \
      -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"admin123"}' \
      | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
  echo "  token issued: ${TOKEN:0:30}..."
  echo "  GET /api/v1/dashboard/overview    -> $(authed $GATE/api/v1/dashboard/overview)"
  echo "  GET /api/v1/assets                -> $(authed $GATE/api/v1/assets)"
  echo
  echo "[5] Failover: stop backend-2, same token must keep working via backend-1"
  docker stop datalineage-backend-ha-2 >/dev/null
  sleep 2
  for i in 1 2 3 4 5; do
    echo "  GET /api/v1/dashboard/overview #$i -> $(authed $GATE/api/v1/dashboard/overview)"
  done
  echo
  echo "[6] Restore backend-2, stop backend-1: token must work via backend-2"
  docker start datalineage-backend-ha-2 >/dev/null
  wait_healthy datalineage-backend-ha-2 && echo "  backend-2 healthy again"
  docker stop datalineage-backend-ha-1 >/dev/null
  sleep 2
  for i in 1 2 3; do
    echo "  GET /api/v1/dashboard/overview #$i -> $(authed $GATE/api/v1/dashboard/overview)"
  done
  echo
  echo "[7] Restore backend-1, final dual-instance state"
  docker start datalineage-backend-ha-1 >/dev/null
  wait_healthy datalineage-backend-ha-1 && echo "  backend-1 healthy again"
  echo "  backend-1 final: $(health datalineage-backend-ha-1)"
  echo "  backend-2 final: $(health datalineage-backend-ha-2)"
  echo
  docker-compose -f docker-compose.ha.yml ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null
} | tee "$REPORT"
echo
echo "Report written to $REPORT"

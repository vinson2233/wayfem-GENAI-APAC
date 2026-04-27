#!/usr/bin/env bash
# =============================================================================
# Wayfem — Test the combined Docker image locally
# Simulates exactly what Cloud Run will run, but on your machine.
#
# What boots:
#   - FastAPI         (foreground, on $PORT)
#   - Calendar MCP    (background subprocess via start.sh, port 8003)
#   - Reddit MCP      (spawned on-demand by community agent via `npx`,
#                      pre-installed globally during build to avoid cold-start
#                      download latency)
#
# Usage:
#   ./test-combined.sh                # build + smoke-test reddit MCP + run
#   ./test-combined.sh build          # force rebuild (also verifies MCPs present)
#   ./test-combined.sh run            # run without rebuilding
#   ./test-combined.sh smoke-reddit   # only smoke-test the Reddit MCP boot
# =============================================================================

set -euo pipefail

CMD="${1:-all}"
IMAGE="wayfem-combined:local"
PORT=8080

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
die()     { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# Load backend .env for secrets
ENV_FILE="$(dirname "$0")/backend/.env"
[[ -f "$ENV_FILE" ]] || die "backend/.env not found — copy backend/.env.example and fill it in"

do_build() {
  info "Building combined image (this takes ~2–3 min on first run)..."
  docker build \
    --platform linux/amd64 \
    -t "$IMAGE" \
    "$(dirname "$0")"
  success "Image built: $IMAGE"

  info "Verifying bundled MCP servers in the image..."
  # Calendar MCP: in-tree Python script
  docker run --rm --entrypoint sh "$IMAGE" -c \
    'test -f mcp_servers/calendar_server.py' \
    && success "Calendar MCP script present" \
    || die "Calendar MCP script missing from image"

  # Reddit MCP: pre-installed npm package, must be reachable via npx
  docker run --rm --entrypoint sh "$IMAGE" -c \
    'npm ls -g reddit-mcp-server --depth=0 2>/dev/null | grep -q reddit-mcp-server' \
    && success "Reddit MCP package pre-installed" \
    || die "Reddit MCP package missing — community agent will fail at runtime"
}

do_smoke_reddit() {
  info "Smoke-testing Reddit MCP (boots the server, captures its setup banner)..."
  # The MCP greets stdout with "[Setup]" lines on launch. We send EOF immediately
  # via </dev/null so it exits cleanly. timeout caps the test at 10 seconds.
  if docker run --rm --entrypoint sh "$IMAGE" -c \
       'REDDIT_AUTH_MODE=anonymous timeout 10 npx -y reddit-mcp-server </dev/null 2>&1 | head -n 8' \
       | grep -q "Setup.*anonymous"; then
    success "Reddit MCP boots and reports anonymous mode"
  else
    info "Reddit MCP smoke test inconclusive — runtime fallback in community_agent will handle this"
  fi
}

do_run() {
  info "Stopping any previous test container..."
  docker rm -f wayfem-test 2>/dev/null || true

  info "Starting Wayfem on http://localhost:${PORT} ..."
  info "  · FastAPI       → :${PORT}"
  info "  · Calendar MCP  → :8003 (in-container, started by start.sh)"
  info "  · Reddit MCP    → spawned on-demand by community agent (npx)"
  docker run --rm \
    --name wayfem-test \
    --platform linux/amd64 \
    -p "${PORT}:8080" \
    --env-file "$ENV_FILE" \
    -e PORT=8080 \
    "$IMAGE"
}

case "$CMD" in
  build)        do_build ;;
  run)          do_run ;;
  smoke-reddit) do_smoke_reddit ;;
  all)          do_build && do_smoke_reddit && do_run ;;
  *)            echo "Usage: $0 [all|build|run|smoke-reddit]"; exit 1 ;;
esac

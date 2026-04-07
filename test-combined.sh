#!/usr/bin/env bash
# =============================================================================
# Wayfem — Test the combined Docker image locally
# Simulates exactly what Cloud Run will run, but on your machine.
#
# Usage:
#   ./test-combined.sh          # build (if needed) + run
#   ./test-combined.sh build    # force rebuild
#   ./test-combined.sh run      # run without rebuilding
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
}

do_run() {
  info "Stopping any previous test container..."
  docker rm -f wayfem-test 2>/dev/null || true

  info "Starting Wayfem on http://localhost:${PORT} ..."
  docker run --rm \
    --name wayfem-test \
    --platform linux/amd64 \
    -p "${PORT}:8080" \
    --env-file "$ENV_FILE" \
    -e PORT=8080 \
    "$IMAGE"
}

case "$CMD" in
  build) do_build ;;
  run)   do_run ;;
  all)   do_build && do_run ;;
  *)     echo "Usage: $0 [all|build|run]"; exit 1 ;;
esac

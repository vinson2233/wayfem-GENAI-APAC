#!/usr/bin/env bash
# =============================================================================
# Wayfem — Single-Service Cloud Run Deployment Script
# =============================================================================
# What gets deployed:
#   · FastAPI         → :8080 (Cloud Run port)
#   · Calendar MCP    → :8003 (in-container, started by start.sh)
#   · Reddit MCP      → spawned on-demand by community agent (npx)
#
# Usage:
#   ./deploy.sh           # full deploy (preflight + secrets + build + verify + deploy + smoke)
#   ./deploy.sh verify    # only preflight env + verify built image (no upload, no deploy)
#   ./deploy.sh secrets   # only create/update secrets in Secret Manager
#   ./deploy.sh build     # only build the combined image (also verifies it)
#   ./deploy.sh deploy    # only deploy (image must already be pushed)
#   ./deploy.sh smoke     # only run post-deploy smoke tests against the live service
# =============================================================================

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
PROJECT_ID="adk-mcp-491804"
REGION="us-central1"
REPO="wayfem"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"

# Single combined service
SVC="wayfem-app"
IMG="${REGISTRY}/app"

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()     { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# ─── Small helpers (defined before load_env_file uses them) ──────────────────
trim() {
  # Strip leading/trailing whitespace and CR/LF (defensive against pasted keys)
  local v="${1-}"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}

key_tail() {
  # Show last 4 chars + length, never the full secret
  local v="$1"
  local n=${#v}
  if (( n < 8 )); then
    printf '(%d chars)' "$n"
  else
    printf '(%d chars, ends in …%s)' "$n" "${v: -4}"
  fi
}

# ─── Load local .env ─────────────────────────────────────────────────────────
# Robust parser: handles `KEY=value`, `KEY="quoted"`, `KEY='quoted'`, and
# JSON-ish values like CORS_ORIGINS=["a","b"]. Skips blank lines and comments.
load_env_file() {
  local file="$1"
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    # strip trailing CR (Windows line endings)
    line="${line%$'\r'}"
    # skip blanks + comments
    [[ -z "${line// }" ]] && continue
    [[ "${line#"${line%%[![:space:]]*}"}" == \#* ]] && continue
    # require KEY=...
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    # trim key whitespace; key must look like an env var name
    key="$(trim "$key")"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # strip surrounding matched quotes from value (single OR double)
    if [[ "$value" =~ ^\".*\"$ ]]; then
      value="${value:1:-1}"
    elif [[ "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:-1}"
    fi
    export "$key=$value"
  done < "$file"
}

ENV_FILE="$(dirname "$0")/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  load_env_file "$ENV_FILE"
  info "Loaded env from $ENV_FILE"
else
  warn ".env not found at $ENV_FILE — preflight will fail"
fi

# ─── Helper: get Cloud Run service URL ───────────────────────────────────────
get_url() {
  gcloud run services describe "$1" \
    --region "$REGION" \
    --format "value(status.url)" 2>/dev/null || echo ""
}

# ─── Helper: create or update a Secret Manager secret ────────────────────────
upsert_secret() {
  local name="$1" raw_value="$2"
  local value
  value="$(trim "$raw_value")"

  if [[ -z "$value" ]]; then
    warn "Skipping secret '$name' — value is empty after trim"
    return
  fi

  local action
  if gcloud secrets describe "$name" --project "$PROJECT_ID" &>/dev/null; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID" >/dev/null
    action="updated"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --project "$PROJECT_ID" >/dev/null
    action="created"
  fi
  success "→ ${action} ${name} $(key_tail "$value")"
}

upsert_secret_file() {
  local name="$1" file="$2"
  if [[ ! -f "$file" ]]; then
    warn "Skipping secret '$name' — file not found: $file"
    return
  fi
  if gcloud secrets describe "$name" --project "$PROJECT_ID" &>/dev/null; then
    gcloud secrets versions add "$name" --data-file="$file" --project "$PROJECT_ID" >/dev/null
    success "→ updated ${name} (from $(basename "$file"))"
  else
    gcloud secrets create "$name" --data-file="$file" --project "$PROJECT_ID" >/dev/null
    success "→ created ${name} (from $(basename "$file"))"
  fi
}

# =============================================================================
step_preflight() {
  info "Pre-flight checklist..."
  local fail=0

  # Hard requirements
  for var in GEMINI_API_KEY GOOGLE_MAPS_API_KEY; do
    local val
    val="$(trim "${!var:-}")"
    if [[ -z "$val" ]]; then
      echo -e "  ${RED}✗${NC} ${var} is missing or empty in $ENV_FILE"
      fail=1
    else
      echo -e "  ${GREEN}✓${NC} ${var} set $(key_tail "$val")"
    fi
  done

  # GOOGLE_CLOUD_PROJECT — must match deploy target
  local cloud_project
  cloud_project="$(trim "${GOOGLE_CLOUD_PROJECT:-}")"
  if [[ -z "$cloud_project" ]]; then
    echo -e "  ${YELLOW}!${NC} GOOGLE_CLOUD_PROJECT not in .env (deploy target is ${PROJECT_ID})"
  elif [[ "$cloud_project" != "$PROJECT_ID" ]]; then
    echo -e "  ${RED}✗${NC} GOOGLE_CLOUD_PROJECT=${cloud_project} does NOT match deploy target ${PROJECT_ID}"
    echo -e "      Update backend/.env to GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
    fail=1
  else
    echo -e "  ${GREEN}✓${NC} GOOGLE_CLOUD_PROJECT matches deploy target"
  fi

  # Soft warnings
  local serper
  serper="$(trim "${SERPER_API_KEY:-}")"
  if [[ -z "$serper" ]]; then
    echo -e "  ${YELLOW}!${NC} SERPER_API_KEY empty — web search will be disabled (safety/community agents will degrade)"
  else
    echo -e "  ${GREEN}✓${NC} SERPER_API_KEY set $(key_tail "$serper")"
  fi

  if (( fail )); then
    die "Pre-flight failed. Fix the issues above before deploying."
  fi
  success "Pre-flight passed."
}

# =============================================================================
step_prerequisites() {
  info "Checking prerequisites..."
  command -v gcloud >/dev/null || die "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  command -v docker >/dev/null || die "docker not found."

  gcloud config set project "$PROJECT_ID" --quiet
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

  info "Enabling required GCP APIs..."
  # generativelanguage.googleapis.com is REQUIRED — without it Gemini calls
  # return INVALID_ARGUMENT / API_KEY_INVALID even with a perfectly good key.
  gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    generativelanguage.googleapis.com \
    --project "$PROJECT_ID" --quiet

  if ! gcloud artifacts repositories describe "$REPO" \
      --location "$REGION" --project "$PROJECT_ID" &>/dev/null; then
    gcloud artifacts repositories create "$REPO" \
      --repository-format=docker \
      --location "$REGION" \
      --project "$PROJECT_ID"
    success "Created Artifact Registry: $REPO"
  else
    info "Artifact Registry '$REPO' already exists"
  fi
}

# =============================================================================
step_secrets() {
  info "Creating/updating secrets in Secret Manager..."

  upsert_secret "wayfem-gemini-key"  "${GEMINI_API_KEY:-}"
  upsert_secret "wayfem-maps-key"    "${GOOGLE_MAPS_API_KEY:-}"
  upsert_secret "wayfem-serper-key"  "${SERPER_API_KEY:-}"

  local creds_file="${GOOGLE_CALENDAR_CREDENTIALS_JSON:-}"
  if [[ -n "$creds_file" && ! -f "$creds_file" ]]; then
    creds_file="$(dirname "$0")/backend/${creds_file#/app/}"
  fi
  upsert_secret_file "wayfem-calendar-creds" "${creds_file:-/dev/null}"

  # Grant default Compute SA access to secrets + Firestore (Cloud Run uses this SA by default)
  local PROJECT_NUMBER
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
  local SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

  info "Granting Secret Manager access to $SA..."
  for secret in wayfem-gemini-key wayfem-maps-key wayfem-serper-key wayfem-calendar-creds; do
    gcloud secrets add-iam-policy-binding "$secret" \
      --member "serviceAccount:${SA}" \
      --role "roles/secretmanager.secretAccessor" \
      --project "$PROJECT_ID" --quiet 2>/dev/null || true
  done

  info "Granting Firestore (datastore.user) to $SA..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${SA}" \
    --role "roles/datastore.user" \
    --condition=None \
    --quiet >/dev/null 2>&1 || warn "Firestore role grant skipped (already bound or org policy denied)"

  success "Secrets ready."
}

# =============================================================================
step_build() {
  info "Building combined Docker image for linux/amd64..."

  # Build from project root (Dockerfile at root)
  docker build \
    --platform linux/amd64 \
    -t "${IMG}:latest" \
    "$(dirname "$0")"

  success "Image built: ${IMG}:latest"
}

# =============================================================================
step_verify_image() {
  info "Verifying bundled MCP servers in the image..."

  if ! docker image inspect "${IMG}:latest" >/dev/null 2>&1; then
    die "Image ${IMG}:latest not found locally — run './deploy.sh build' first."
  fi

  # Calendar MCP: in-tree Python script
  if docker run --rm --entrypoint sh "${IMG}:latest" -c \
       'test -f mcp_servers/calendar_server.py' >/dev/null 2>&1; then
    success "Calendar MCP script present"
  else
    die "Calendar MCP script missing from image"
  fi

  # Reddit MCP: pre-installed npm package, must be reachable via npx
  if docker run --rm --entrypoint sh "${IMG}:latest" -c \
       'npm ls -g reddit-mcp-server --depth=0 2>/dev/null | grep -q reddit-mcp-server' \
       >/dev/null 2>&1; then
    success "Reddit MCP package pre-installed"
  else
    die "Reddit MCP package missing — community agent will fail at runtime. Re-run './deploy.sh build'."
  fi
}

step_push() {
  info "Pushing image to Artifact Registry..."
  docker push "${IMG}:latest"
  success "Image pushed: ${IMG}:latest"
}

# =============================================================================
step_deploy() {
  info "Deploying combined Wayfem service to Cloud Run..."
  echo
  echo -e "${CYAN}  · FastAPI         → :8080 (Cloud Run port)${NC}"
  echo -e "${CYAN}  · Calendar MCP    → :8003 (in-container, started by start.sh)${NC}"
  echo -e "${CYAN}  · Reddit MCP      → spawned on-demand by community agent (npx)${NC}"
  echo

  gcloud run deploy "$SVC" \
    --image "${IMG}:latest" \
    --platform managed \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --port 8080 \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},ENABLE_WEB_SEARCH=true,CORS_ORIGINS=[\"*\"]" \
    --set-secrets "GEMINI_API_KEY=wayfem-gemini-key:latest,GOOGLE_MAPS_API_KEY=wayfem-maps-key:latest,SERPER_API_KEY=wayfem-serper-key:latest,GOOGLE_CALENDAR_CREDENTIALS_JSON=wayfem-calendar-creds:latest" \
    --allow-unauthenticated \
    --min-instances 1 \
    --memory 2Gi \
    --cpu 2 \
    --cpu-boost \
    --timeout 300 \
    --quiet

  APP_URL=$(get_url "$SVC")
  echo ""
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo -e "${GREEN}  🌍 Wayfem deployed!${NC}"
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo ""
  echo -e "  App URL:   ${CYAN}${APP_URL}${NC}"
  echo -e "  API docs:  ${CYAN}${APP_URL}/docs${NC}"
  echo -e "  Health:    ${CYAN}${APP_URL}/health${NC}"
  echo ""
  echo -e "  Logs:  ${YELLOW}gcloud run services logs read $SVC --region $REGION${NC}"
  echo ""
}

# =============================================================================
step_smoke() {
  local app_url
  app_url=$(get_url "$SVC")
  if [[ -z "$app_url" ]]; then
    die "Cloud Run service '$SVC' not found in $REGION — deploy first."
  fi

  info "Smoke test 1/2 — health check (${app_url}/health)"
  local health_status
  health_status=$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 30 --retry 5 --retry-delay 3 --retry-connrefused \
    "${app_url}/health" || echo "000")
  if [[ "$health_status" != "200" ]]; then
    warn "/health returned HTTP $health_status"
    echo -e "  ${YELLOW}→${NC} Check logs:  gcloud run services logs read $SVC --region $REGION --limit 50"
    return 1
  fi
  success "/health returned 200"

  info "Smoke test 2/2 — Gemini key (curl /api/v1/safety/Cairo%20EG, 60s timeout)"
  # If GEMINI_API_KEY is broken, the safety agent falls back to "112" instead of
  # the real Egyptian numbers (122 police · 123 ambulance · 180 fire).
  local body
  body=$(curl -s --max-time 60 "${app_url}/api/v1/safety/Cairo%20EG" || echo "")

  if [[ -z "$body" ]]; then
    warn "Safety endpoint did not respond within 60s"
    return 1
  fi

  if echo "$body" | grep -q '"emergency_number"\s*:\s*"112"'; then
    warn "Gemini key still appears broken — safety endpoint returned the '112' fallback"
    echo
    echo -e "  ${YELLOW}Likely fixes (in order of probability):${NC}"
    echo -e "    1. Your GEMINI_API_KEY has API restrictions excluding generativelanguage.googleapis.com"
    echo -e "       → GCP Console → APIs & Services → Credentials → edit key → Enable 'Generative Language API'"
    echo -e "    2. The key was created in a different project than ${PROJECT_ID}"
    echo -e "       → Recreate the key under project ${PROJECT_ID}"
    echo -e "    3. The key has HTTP referrer / IP restrictions (Cloud Run egress IPs rotate)"
    echo -e "       → Remove referrer/IP restrictions on the key"
    echo
    echo -e "  After fixing, push a new secret version:"
    echo -e "    ${CYAN}./deploy.sh secrets${NC}"
    echo -e "    ${CYAN}gcloud run services update $SVC --region $REGION --quiet${NC}    # picks up :latest"
    return 1
  elif echo "$body" | grep -qE '"emergency_number"\s*:\s*"[0-9]{2,4}'; then
    success "Gemini smoke test passed — safety endpoint returned a real emergency number"
  else
    warn "Couldn't determine emergency_number from response — check the body manually:"
    echo "$body" | head -c 400
    echo
    return 1
  fi
}

# =============================================================================
# Main
# =============================================================================
CMD="${1:-all}"

case "$CMD" in
  verify)
    step_preflight
    step_verify_image
    ;;
  secrets)
    step_preflight
    step_prerequisites
    step_secrets
    ;;
  build)
    step_prerequisites
    step_build
    step_verify_image
    ;;
  deploy)
    step_prerequisites
    step_deploy
    step_smoke || warn "Smoke tests reported issues — see above."
    ;;
  smoke)
    step_smoke
    ;;
  all)
    step_preflight
    step_prerequisites
    step_secrets
    step_build
    step_verify_image
    step_push
    step_deploy
    step_smoke || warn "Smoke tests reported issues — see above."
    ;;
  *)
    echo "Usage: $0 [all|verify|secrets|build|deploy|smoke]"
    exit 1
    ;;
esac

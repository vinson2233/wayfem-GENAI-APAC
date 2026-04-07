#!/usr/bin/env bash
# =============================================================================
# Wayfem — Single-Service Cloud Run Deployment Script
# =============================================================================
# Usage:
#   ./deploy.sh           # full deploy (build + push + deploy)
#   ./deploy.sh secrets   # only create/update secrets
#   ./deploy.sh build     # only build & push the combined image
#   ./deploy.sh deploy    # only deploy (image must already be pushed)
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

# ─── Load local .env ─────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$' | xargs)
  info "Loaded env from $ENV_FILE"
else
  warn ".env not found at $ENV_FILE — secret creation will be skipped"
fi

# ─── Helper: get Cloud Run service URL ───────────────────────────────────────
get_url() {
  gcloud run services describe "$1" \
    --region "$REGION" \
    --format "value(status.url)" 2>/dev/null || echo ""
}

# ─── Helper: create or update a Secret Manager secret ───────────────────────
upsert_secret() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    warn "Skipping secret '$name' — value is empty"
    return
  fi
  if gcloud secrets describe "$name" --project "$PROJECT_ID" &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID"
    success "Updated secret: $name"
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --project "$PROJECT_ID"
    success "Created secret: $name"
  fi
}

upsert_secret_file() {
  local name="$1" file="$2"
  if [[ ! -f "$file" ]]; then
    warn "Skipping secret '$name' — file not found: $file"
    return
  fi
  if gcloud secrets describe "$name" --project "$PROJECT_ID" &>/dev/null; then
    gcloud secrets versions add "$name" --data-file="$file" --project "$PROJECT_ID"
    success "Updated secret: $name (from file)"
  else
    gcloud secrets create "$name" --data-file="$file" --project "$PROJECT_ID"
    success "Created secret: $name (from file)"
  fi
}

# =============================================================================
step_prerequisites() {
  info "Checking prerequisites..."
  command -v gcloud >/dev/null || die "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  command -v docker >/dev/null || die "docker not found."

  gcloud config set project "$PROJECT_ID"
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

  info "Enabling required GCP APIs..."
  gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
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

  # Grant default Compute SA access (Cloud Run uses this by default)
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

  info "Pushing image to Artifact Registry..."
  docker push "${IMG}:latest"
  success "Image pushed: ${IMG}:latest"
}

# =============================================================================
step_deploy() {
  info "Deploying combined Wayfem service to Cloud Run..."

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
# Main
# =============================================================================
CMD="${1:-all}"

case "$CMD" in
  secrets)
    step_prerequisites
    step_secrets
    ;;
  build)
    step_prerequisites
    step_build
    ;;
  deploy)
    step_prerequisites
    step_deploy
    ;;
  all)
    step_prerequisites
    step_secrets
    step_build
    step_deploy
    ;;
  *)
    echo "Usage: $0 [all|secrets|build|deploy]"
    exit 1
    ;;
esac

# =============================================================================
# Wayfem — Combined Docker Image
# Stage 1: Build React frontend
# Stage 2: Python backend + Node.js + frontend dist
# =============================================================================

# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# VITE_API_BASE_URL is intentionally empty — same origin in combined mode
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Stage 2: Backend + runtime ───────────────────────────────────────────────
FROM python:3.11-slim

# Install Node.js (needed for official MCP servers: google-maps, etc.)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy built frontend into backend/frontend_dist (FastAPI serves it)
COPY --from=frontend-builder /frontend/dist ./frontend_dist

# Make startup script executable
RUN chmod +x start.sh

# Cloud Run sets PORT automatically; default 8080
EXPOSE 8080

CMD ["./start.sh"]

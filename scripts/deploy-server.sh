#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${2:-asia-northeast1}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/notifoo/push-server"

echo "==> Building Docker image..."
docker build --platform linux/amd64 -t "${IMAGE}:latest" server/

echo "==> Pushing to Artifact Registry..."
docker push "${IMAGE}:latest"

echo "==> Deploying to Cloud Run..."
gcloud run services update notifoo-push-server \
  --region="${REGION}" \
  --image="${IMAGE}:latest" \
  --project="${PROJECT_ID}" \
  --quiet

echo "==> Deploy complete!"
gcloud run services describe notifoo-push-server \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)"

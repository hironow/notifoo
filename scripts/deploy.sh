#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
BUCKET_NAME="${PROJECT_ID}-notifoo-pwa"

echo "==> Building production bundle..."
tsc && vp build

echo "==> Syncing dist/ to gs://${BUCKET_NAME}/ ..."
gcloud storage rsync dist/ "gs://${BUCKET_NAME}/" \
  --recursive \
  --delete-unmatched-destination-objects \
  --cache-control="public, max-age=3600"

echo "==> Setting no-cache headers for sw.js and index.html..."
gcloud storage objects update "gs://${BUCKET_NAME}/sw.js" \
  --cache-control="no-cache, no-store"
gcloud storage objects update "gs://${BUCKET_NAME}/index.html" \
  --cache-control="no-cache, no-store"

echo "==> Invalidating CDN cache..."
gcloud compute url-maps invalidate-cdn-cache notifoo-url-map \
  --path="/*" \
  --async 2>/dev/null || echo "    (CDN cache invalidation skipped - LB may not exist yet)"

echo "==> Deploy complete!"
echo "    Bucket: gs://${BUCKET_NAME}/"

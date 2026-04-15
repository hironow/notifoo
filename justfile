# notifoo - PWA development tasks

# Load deploy vars if available
set dotenv-load := false

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

# Start development server
dev:
    vp dev

# Start dev server (open browser)
dev-open:
    vp dev --open

# Start push server locally
dev-server:
    cd server && bun run dev

# ---------------------------------------------------------------------------
# Build & Check
# ---------------------------------------------------------------------------

# Production build
build:
    tsc && vp build

# Lint, format, typecheck
check:
    vp check

# Lint, format, typecheck with auto-fix
fix:
    vp check --fix

# Build push server
build-server:
    cd server && bun run build

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

# Run all E2E tests
test:
    bunx playwright test --reporter=list

# Run PWA tests only
test-pwa:
    bunx playwright test --reporter=list tests/e2e/pwa.spec.ts

# Run OAuth tests only
test-auth:
    bunx playwright test --reporter=list tests/e2e/auth.spec.ts

# Run tests with HTML report
test-report:
    bunx playwright test --reporter=html && bunx playwright show-report

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

# Deploy PWA to GCS
deploy project_id="":
    #!/usr/bin/env bash
    pid="${1:-${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
    bash scripts/deploy.sh "$pid"

# Build and deploy push server to Cloud Run
deploy-server project_id="" region="asia-northeast1":
    #!/usr/bin/env bash
    pid="${1:-${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
    rgn="${2:-${REGION:-asia-northeast1}}"
    image="${rgn}-docker.pkg.dev/${pid}/notifoo/push-server"
    gcloud builds submit server/ --tag="${image}:latest" --project="${pid}" --region="${rgn}"
    gcloud run services update notifoo-push-server --region="${rgn}" --image="${image}:latest" --project="${pid}" --quiet

# Deploy everything (infra + server + PWA)
deploy-all project_id="" domain="" vapid_private_key="":
    #!/usr/bin/env bash
    pid="${1:-${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
    dom="${2:-${DOMAIN:-}}"
    vpk="${3:-${VAPID_PRIVATE_KEY:-}}"
    cd tofu && tofu apply -var="project_id=${pid}" -var="domain=${dom}" -var="vapid_private_key=${vpk}" -auto-approve
    cd ..
    just deploy-server "$pid"
    just deploy "$pid"

# ---------------------------------------------------------------------------
# Infrastructure
# ---------------------------------------------------------------------------

# Run tofu plan
plan project_id="":
    #!/usr/bin/env bash
    pid="${1:-${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
    cd tofu && tofu plan -var="project_id=${pid}"

# Run tofu apply
apply project_id="" domain="" vapid_private_key="":
    #!/usr/bin/env bash
    pid="${1:-${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
    dom="${2:-${DOMAIN:-}}"
    vpk="${3:-${VAPID_PRIVATE_KEY:-}}"
    cd tofu && tofu apply -var="project_id=${pid}" -var="domain=${dom}" -var="vapid_private_key=${vpk}"

# Destroy all infrastructure
destroy project_id="":
    #!/usr/bin/env bash
    pid="${1:-${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
    cd tofu && tofu destroy -var="project_id=${pid}"

# Invalidate CDN cache
cdn-invalidate:
    gcloud compute url-maps invalidate-cdn-cache notifoo-url-map --path="/*"

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

# Install all dependencies
setup:
    bun install
    cd server && bun install

# Install Playwright browsers
setup-playwright:
    bunx playwright install chromium --with-deps

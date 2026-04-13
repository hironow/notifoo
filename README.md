# notifoo

A production-ready Progressive Web App built with React 19, VitePlus, and Web Awesome.

**Live:** https://34-54-205-56.sslip.io

## Tech Stack

- **React 19** + React Router 7
- **VitePlus** (Vite 8 + Rolldown + Oxlint + Oxfmt)
- **Web Awesome** (UI components via CDN)
- **Workbox 7** (Service Worker precaching + offline)
- **Playwright** (E2E testing, 24 tests)
- **Hono** (Push notification + OAuth demo server on Cloud Run)
- **OpenTofu** (GCS + Cloud LB + Cloud CDN + Cloud Run)

## Quick Start

```bash
pnpm install
vp dev
```

## Commands

| Command         | Description               |
| --------------- | ------------------------- |
| `vp dev`        | Development server        |
| `vp build`      | Production build          |
| `vp check`      | Lint + format + typecheck |
| `pnpm test:e2e` | E2E tests (Playwright)    |
| `pnpm deploy`   | Deploy PWA to GCS         |

## Infrastructure

All infrastructure is managed with OpenTofu in `tofu/`.

```bash
cd tofu
tofu init
tofu apply -var="project_id=YOUR_PROJECT" -var="domain=YOUR_DOMAIN"
```

See [docs/infrastructure.md](docs/infrastructure.md) for architecture details.

## Project Structure

```
src/                    React application
  pages/                Home, About, Auth (OAuth test)
  components/           Header
  styles/               Global CSS
server/                 Push notification + OAuth demo server (Hono)
tests/e2e/              Playwright E2E tests
tofu/                   OpenTofu infrastructure (GCS + LB + CDN + Cloud Run)
scripts/                Deploy scripts
docs/                   Architecture documentation
public/                 Static assets, manifest, service worker
```

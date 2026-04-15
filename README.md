# notifoo

A production-ready Progressive Web App built with React 19, VitePlus, and Web Awesome.

**Live:** https://34-54-205-56.sslip.io

## Tech Stack

- **React 19** + React Router 7
- **VitePlus** (Vite 8 + Rolldown + Oxlint + Oxfmt)
- **Web Awesome** (UI components via CDN)
- **Workbox 7** (Service Worker precaching + offline)
- **Playwright** (E2E testing, 46 tests)
- **oauth4webapi** (OAuth 2.0 / OIDC conformance testing)
- **Hono** (Push notification + OAuth demo server on Cloud Run)
- **OpenTofu** (GCS + Cloud LB + Cloud CDN + Cloud Run)

## Quick Start

```bash
bun install
vp dev
```

## Commands

| Command       | Description               |
| ------------- | ------------------------- |
| `vp dev`      | Development server        |
| `vp build`    | Production build          |
| `vp check`    | Lint + format + typecheck |
| `just test`   | E2E tests (Playwright)    |
| `just deploy` | Deploy PWA to GCS         |

## Infrastructure

All infrastructure is managed with OpenTofu in `tofu/`.

```bash
cd tofu
tofu init
tofu apply -var="project_id=YOUR_PROJECT" -var="domain=YOUR_DOMAIN"
```

See [docs/infrastructure.md](docs/infrastructure.md) for architecture details.

## OAuth Demo

The `/auth` page demonstrates OAuth 2.0 Authorization Code Flow + PKCE (RFC 6749 / RFC 7636) with two patterns: full-page redirect and popup window.

See [docs/oauth.md](docs/oauth.md) for flow details, endpoint reference, and redirect vs popup comparison.

## Documentation

| Document                                         | Contents                                               |
| ------------------------------------------------ | ------------------------------------------------------ |
| [docs/infrastructure.md](docs/infrastructure.md) | GCS + LB + CDN architecture, deploy commands           |
| [docs/oauth.md](docs/oauth.md)                   | OAuth flow, PKCE, redirect vs popup, conformance tests |
| [docs/glossary.md](docs/glossary.md)             | Term definitions (OAuth, PWA, infrastructure, tooling) |

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

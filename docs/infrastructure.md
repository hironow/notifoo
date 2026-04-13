# Infrastructure

notifoo PWA is hosted on GCP using GCS + Global Application Load Balancer + Cloud CDN.

## Architecture

```
                         Internet
                            |
                   +--------+--------+
                   |                 |
              HTTP :80          HTTPS :443
                   |                 |
                   v                 v
         +----------------+  +----------------+
         | HTTP Proxy     |  | HTTPS Proxy    |
         | (redirect 301) |  | (SSL termination)
         +----------------+  +----------------+
                   |                 |
                   +--------+--------+
                            |
                            v
                   +------------------+
                   | URL Map          |
                   | (SPA Routing)    |
                   +------------------+
                            |
                            |
                            v
         +------------------------------------+
         |        Backend Bucket              |
         |        (Cloud CDN enabled)         |
         +------------------------------------+
                            |
                            v
         +------------------------------------+
         |        GCS Bucket                  |
         |  gen-ai-hironow-notifoo-pwa        |
         |        (ASIA-NORTHEAST1)           |
         +------------------------------------+
                            |
              +-------------+-------------+
              |                           |
         File exists              File not found
         (200 OK)                 (not_found_page)
              |                           |
              v                           v
         Serve file              +-------------------+
         directly                | Error Response    |
                                 | Policy: 4xx -> 200|
                                 | Serve /index.html |
                                 +-------------------+
```

```
Legend:
- HTTP Proxy: HTTP -> HTTPS redirect (domain required)
- HTTPS Proxy: SSL termination with Google-managed cert
- URL Map: SPA routing with path-based rules
- Backend Bucket: Cloud CDN cache layer
- GCS Bucket: Static file storage (public read)
```

## Network Boundary

```
+================================================================+
|  PUBLIC (Internet-facing)                                      |
|                                                                |
|  +----------------------------------------------------------+ |
|  | Global External IP (notifoo-lb-ip)                        | |
|  | Forwarding Rules: port 80, port 443                       | |
|  +----------------------------------------------------------+ |
|                            |                                   |
|  +----------------------------------------------------------+ |
|  | Global Application Load Balancer (EXTERNAL_MANAGED)       | |
|  |                                                           | |
|  |  URL Map: notifoo-url-map                                 | |
|  |    Priority 1-3:   /code/* /assets/* /widget/* -> direct  | |
|  |    Priority 10-12: /sw.js /sw.js.map /manifest.json       | |
|  |    SPA fallback: custom_error_response_policy             | |
|  |      4xx -> 200, serve /index.html from backend bucket    | |
|  |                                                           | |
|  |  Cloud CDN: CACHE_ALL_STATIC                              | |
|  |    default_ttl:  3600s (1h)                               | |
|  |    max_ttl:      86400s (24h)                             | |
|  |    stale:        86400s (24h)                             | |
|  +----------------------------------------------------------+ |
|                            |                                   |
|  +----------------------------------------------------------+ |
|  | GCS Bucket (uniform bucket-level access)                  | |
|  |   IAM: allUsers -> roles/storage.objectViewer             | |
|  |   Website: main_page=index.html, 404=index.html          | |
|  |   CORS: GET, HEAD from *                                  | |
|  +----------------------------------------------------------+ |
|                                                                |
+================================================================+

+================================================================+
|  PRIVATE (GCP project internal)                                |
|                                                                |
|  +----------------------------------------------------------+ |
|  | Google-managed SSL Certificate (domain required)          | |
|  |   Auto-provisioned, auto-renewed                          | |
|  +----------------------------------------------------------+ |
|                                                                |
|  +----------------------------------------------------------+ |
|  | OpenTofu State (local or remote backend)                  | |
|  |   tofu/terraform.tfstate                                  | |
|  +----------------------------------------------------------+ |
|                                                                |
|  +----------------------------------------------------------+ |
|  | Deploy Credentials                                        | |
|  |   gcloud auth (user or service account)                   | |
|  |   Required roles:                                         | |
|  |     - roles/storage.admin (bucket + objects)              | |
|  |     - roles/compute.admin (LB, URL map, SSL)             | |
|  +----------------------------------------------------------+ |
|                                                                |
+================================================================+
```

## Cache Strategy

| File                        | Cache-Control          | Reason                                  |
| --------------------------- | ---------------------- | --------------------------------------- |
| `/code/*.js`, `/code/*.css` | `public, max-age=3600` | Content-hashed filenames, safe to cache |
| `/assets/**`                | `public, max-age=3600` | Static icons/screenshots                |
| `/index.html`               | `no-cache, no-store`   | App shell entry, must always be fresh   |
| `/sw.js`                    | `no-cache, no-store`   | SW updates must propagate immediately   |
| `/manifest.json`            | `public, max-age=3600` | Rarely changes                          |

## OpenTofu Resources

| Resource                                 | Name                         | Purpose                   |
| ---------------------------------------- | ---------------------------- | ------------------------- |
| `google_storage_bucket`                  | `gen-ai-hironow-notifoo-pwa` | Static file storage       |
| `google_storage_bucket_iam_member`       | `allUsers`                   | Public read access        |
| `google_compute_backend_bucket`          | `notifoo-backend-bucket`     | CDN-enabled backend       |
| `google_compute_url_map`                 | `notifoo-url-map`            | SPA routing rules         |
| `google_compute_global_address`          | `notifoo-lb-ip`              | Static external IP        |
| `google_compute_target_http_proxy`       | `notifoo-http-proxy`         | HTTP entry point          |
| `google_compute_global_forwarding_rule`  | `notifoo-http-forwarding`    | Port 80 listener          |
| `google_compute_managed_ssl_certificate` | `notifoo-ssl-cert`           | HTTPS cert (domain only)  |
| `google_compute_target_https_proxy`      | `notifoo-https-proxy`        | HTTPS entry (domain only) |
| `google_compute_global_forwarding_rule`  | `notifoo-https-forwarding`   | Port 443 (domain only)    |
| `google_compute_url_map`                 | `notifoo-http-redirect`      | HTTP->HTTPS (domain only) |

## Deploy

```bash
# Infrastructure provisioning
cd tofu
tofu init
tofu apply -var="project_id=gen-ai-hironow"

# With custom domain (enables HTTPS + redirect)
tofu apply -var="project_id=gen-ai-hironow" -var="domain=notifoo.example.com"

# Application deployment
pnpm deploy
```

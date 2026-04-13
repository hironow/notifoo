# =============================================================================
# GCS Bucket - Static PWA hosting
# =============================================================================

resource "google_storage_bucket" "pwa" {
  name     = "${var.project_id}-notifoo-pwa"
  location = var.bucket_location

  uniform_bucket_level_access = true
  force_destroy               = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.pwa.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# =============================================================================
# Backend Bucket with Cloud CDN
# =============================================================================

resource "google_compute_backend_bucket" "pwa" {
  name        = "notifoo-backend-bucket"
  bucket_name = google_storage_bucket.pwa.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    max_ttl           = 86400
    client_ttl        = 3600
    negative_caching  = false
    serve_while_stale = 86400
  }

  custom_response_headers = [
    "X-Content-Type-Options: nosniff",
    "X-Frame-Options: DENY",
    "Referrer-Policy: strict-origin-when-cross-origin",
  ]
}

# =============================================================================
# URL Map - SPA routing (rewrite non-asset paths to /index.html)
# =============================================================================

resource "google_compute_url_map" "pwa" {
  name            = "notifoo-url-map"
  default_service = google_compute_backend_bucket.pwa.id

  host_rule {
    hosts        = ["*"]
    path_matcher = "spa"
  }

  path_matcher {
    name            = "spa"
    default_service = google_compute_backend_bucket.pwa.id

    # Static JS/CSS bundles (Vite output)
    route_rules {
      priority = 1
      service  = google_compute_backend_bucket.pwa.id
      match_rules {
        prefix_match = "/code/"
      }
    }

    # Static assets (icons, screenshots)
    route_rules {
      priority = 2
      service  = google_compute_backend_bucket.pwa.id
      match_rules {
        prefix_match = "/assets/"
      }
    }

    # Widget files
    route_rules {
      priority = 3
      service  = google_compute_backend_bucket.pwa.id
      match_rules {
        prefix_match = "/widget/"
      }
    }

    # Service Worker (must not be rewritten, must not be cached)
    route_rules {
      priority = 10
      service  = google_compute_backend_bucket.pwa.id
      match_rules {
        full_path_match = "/sw.js"
      }
    }

    route_rules {
      priority = 11
      service  = google_compute_backend_bucket.pwa.id
      match_rules {
        full_path_match = "/sw.js.map"
      }
    }

    # PWA manifest
    route_rules {
      priority = 12
      service  = google_compute_backend_bucket.pwa.id
      match_rules {
        full_path_match = "/manifest.json"
      }
    }

  }

  # SPA fallback: GCS returns index.html as not_found_page with 404 status.
  # This policy overrides the 404 status to 200 for the SPA app shell.
  default_custom_error_response_policy {
    error_service = google_compute_backend_bucket.pwa.id
    error_response_rule {
      match_response_codes   = ["4xx"]
      path                   = "/index.html"
      override_response_code = 200
    }
  }
}

# =============================================================================
# HTTPS Load Balancer
# =============================================================================

resource "google_compute_global_address" "pwa" {
  name = "notifoo-lb-ip"
}

# Google-managed SSL certificate (requires custom domain)
resource "google_compute_managed_ssl_certificate" "pwa" {
  count = var.domain != "" ? 1 : 0
  name  = "notifoo-ssl-cert"

  managed {
    domains = [var.domain]
  }
}

resource "google_compute_target_https_proxy" "pwa" {
  count   = var.domain != "" ? 1 : 0
  name    = "notifoo-https-proxy"
  url_map = google_compute_url_map.pwa.id

  ssl_certificates = [google_compute_managed_ssl_certificate.pwa[0].id]
}

resource "google_compute_global_forwarding_rule" "https" {
  count                 = var.domain != "" ? 1 : 0
  name                  = "notifoo-https-forwarding"
  target                = google_compute_target_https_proxy.pwa[0].id
  ip_address            = google_compute_global_address.pwa.address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# =============================================================================
# HTTP forwarding (redirect to HTTPS when domain is set, serve directly otherwise)
# =============================================================================

# With domain: HTTP -> HTTPS redirect
resource "google_compute_url_map" "http_redirect" {
  count = var.domain != "" ? 1 : 0
  name  = "notifoo-http-redirect"

  default_url_redirect {
    https_redirect         = true
    strip_query            = false
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
  }
}

resource "google_compute_target_http_proxy" "pwa" {
  name    = "notifoo-http-proxy"
  url_map = var.domain != "" ? google_compute_url_map.http_redirect[0].id : google_compute_url_map.pwa.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "notifoo-http-forwarding"
  target                = google_compute_target_http_proxy.pwa.id
  ip_address            = google_compute_global_address.pwa.address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

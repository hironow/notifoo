# =============================================================================
# Artifact Registry - Docker image repository
# =============================================================================

resource "google_artifact_registry_repository" "push_server" {
  location      = var.region
  repository_id = "notifoo"
  format        = "DOCKER"
}

# =============================================================================
# Cloud Run - Push notification server
# =============================================================================

resource "google_cloud_run_v2_service" "push_server" {
  name     = "notifoo-push-server"
  location = var.region

  deletion_protection = false

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.push_server.repository_id}/push-server:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "VAPID_PUBLIC_KEY"
        value = var.vapid_public_key
      }

      env {
        name  = "VAPID_PRIVATE_KEY"
        value = var.vapid_private_key
      }

      env {
        name  = "VAPID_SUBJECT"
        value = "mailto:admin@notifoo.example.com"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
  }

  depends_on = [google_artifact_registry_repository.push_server]
}

# Allow unauthenticated access (public API)
resource "google_cloud_run_v2_service_iam_member" "push_server_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.push_server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# Outputs
# =============================================================================

output "push_server_url" {
  description = "Push notification server URL"
  value       = google_cloud_run_v2_service.push_server.uri
}

output "docker_image_tag" {
  description = "Docker image tag for push server"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.push_server.repository_id}/push-server"
}

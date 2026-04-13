output "load_balancer_ip" {
  description = "External IP address of the load balancer"
  value       = google_compute_global_address.pwa.address
}

output "bucket_name" {
  description = "GCS bucket name for deploying the PWA"
  value       = google_storage_bucket.pwa.name
}

output "bucket_url" {
  description = "GCS bucket URL"
  value       = google_storage_bucket.pwa.url
}

output "site_url" {
  description = "Public URL of the PWA"
  value       = var.domain != "" ? "https://${var.domain}" : "https://${google_compute_global_address.pwa.address}"
}

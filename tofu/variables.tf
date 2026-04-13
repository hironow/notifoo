variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "asia-northeast1"
}

variable "domain" {
  description = "Custom domain for the PWA (e.g., notifoo.example.com). Leave empty to use the load balancer IP only."
  type        = string
  default     = ""
}

variable "bucket_location" {
  description = "GCS bucket location"
  type        = string
  default     = "ASIA-NORTHEAST1"
}

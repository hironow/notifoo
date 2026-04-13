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

variable "vapid_public_key" {
  description = "VAPID public key for web push notifications"
  type        = string
  default     = "BMlhI-USgEOyTW9WYGY9MrEj-KqKFLV2bKPjoOpum_pxmUj5A9NrrFSvxo2nP7AOjLWSv63EInxcTAvVHd24ypk"
}

variable "vapid_private_key" {
  description = "VAPID private key for web push notifications"
  type        = string
  sensitive   = true
  default     = ""
}

variable "bucket_location" {
  description = "GCS bucket location"
  type        = string
  default     = "ASIA-NORTHEAST1"
}

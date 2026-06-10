# Smoke test: mock_provider + command = plan validates the configuration is
# syntactically correct and default values match the contract.
# No validation blocks exist in this module; this satisfies the Layer 1
# minimum (one plan-only test per module) and asserts all defaults.

mock_provider "google" {}

variables {
  project_id = "test-project"
}

run "smoke_plan_succeeds_and_defaults_are_correct" {
  command = plan

  assert {
    condition     = var.region == "asia-northeast1"
    error_message = "region default must be asia-northeast1."
  }

  assert {
    condition     = var.domain == ""
    error_message = "domain default must be empty (no custom domain by default)."
  }

  assert {
    condition     = var.vapid_public_key == "BMlhI-USgEOyTW9WYGY9MrEj-KqKFLV2bKPjoOpum_pxmUj5A9NrrFSvxo2nP7AOjLWSv63EInxcTAvVHd24ypk"
    error_message = "vapid_public_key default must match the known VAPID key."
  }

  assert {
    condition     = var.vapid_private_key == ""
    error_message = "vapid_private_key default must be empty (supplied out-of-band)."
  }

  assert {
    condition     = var.bucket_location == "ASIA-NORTHEAST1"
    error_message = "bucket_location default must be ASIA-NORTHEAST1."
  }
}

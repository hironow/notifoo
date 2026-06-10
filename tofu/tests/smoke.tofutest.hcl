# Smoke test: mock_provider + command = plan ensures the configuration
# is syntactically valid and all defaults are reachable with minimal input.
# No validation blocks exist in this module; this test satisfies the
# Layer 1 minimum (one plan-only test per module).

mock_provider "google" {}

variables {
  project_id = "test-project"
}

run "smoke_plan_succeeds" {
  command = plan

  assert {
    condition     = var.region == "asia-northeast1"
    error_message = "region default must be asia-northeast1."
  }

  assert {
    condition     = var.bucket_location == "ASIA-NORTHEAST1"
    error_message = "bucket_location default must be ASIA-NORTHEAST1."
  }
}

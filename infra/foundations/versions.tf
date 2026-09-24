terraform {
  required_version = "= 1.12.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.66.0"
    }
  }
  # bucket, région et compte sont fournis par backend.hcl, sans credentials.
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }
}

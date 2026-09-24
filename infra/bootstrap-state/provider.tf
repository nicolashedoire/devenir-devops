provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.expected_account_id]
  # Authentification externe : AWS_PROFILE et session temporaire, jamais de clé ici.
}

locals {
  name = "${var.project}-${var.environment}"
  common_tags = merge(var.tags, {
    Project     = var.project
    Environment = var.environment
    Owner       = var.owner
    ManagedBy   = "OpenTofu"
    Workshop    = "devenir-devops"
  })
}

data "aws_caller_identity" "current" {
  lifecycle {
    postcondition {
      condition     = self.account_id == var.expected_account_id
      error_message = "Le compte authentifié diffère du compte attendu : opération interrompue."
    }
  }
}

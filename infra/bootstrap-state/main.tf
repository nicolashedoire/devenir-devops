variable "state_bucket_name" {
  description = "Nom S3 globalement unique choisi pour CE compte ; remplacer l'exemple avant tout plan réel."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,61}[a-z0-9]$", var.state_bucket_name)) && !startswith(var.state_bucket_name, "xn--") && !endswith(var.state_bucket_name, "-s3alias") && !endswith(var.state_bucket_name, "--ol-s3") && !endswith(var.state_bucket_name, "--x-s3") && !endswith(var.state_bucket_name, "--table-s3")
    error_message = "Choisir un nom S3 de 3 à 63 caractères minuscules/chiffres/tirets, sans suffixe réservé."
  }
}

locals {
  state_key  = "${var.project}/${var.environment}/foundations.tfstate"
  bucket_arn = "arn:aws:s3:::${var.state_bucket_name}"
}

resource "aws_s3_bucket" "state" {
  bucket        = var.state_bucket_name
  force_destroy = false
  tags          = merge(local.common_tags, { Name = "${local.name}-state" })
  depends_on    = [data.aws_caller_identity.current]
  lifecycle {
    # Barrière locale OpenTofu ; ne remplace ni IAM ni une sauvegarde de l'état.
    prevent_destroy = true
    precondition {
      condition     = terraform.workspace == "default"
      error_message = "L'amorçage utilise uniquement le workspace default."
    }
  }
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "tls" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [local.bucket_arn, "${local.bucket_arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.state]
}

output "state_bucket_name" {
  description = "Bucket dédié aux états du laboratoire."
  value       = aws_s3_bucket.state.bucket
}

output "backend_hcl" {
  description = "Configuration backend sans credentials, à écrire dans foundations/backend.hcl après contrôle."
  value       = <<-HCL
    bucket              = "${var.state_bucket_name}"
    key                 = "${local.state_key}"
    region              = "${var.aws_region}"
    allowed_account_ids = ["${var.expected_account_id}"]
    encrypt             = true
    use_lockfile        = true
  HCL
  depends_on  = [aws_s3_bucket_versioning.state, aws_s3_bucket_server_side_encryption_configuration.state, aws_s3_bucket_policy.tls]
}

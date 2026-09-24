# Plan simulé uniquement : évite toute création et le nettoyage d'un bucket protégé.
mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:role/mock-lab"
      user_id    = "mock-lab"
    }
  }
}

variables {
  expected_account_id = "123456789012"
  aws_region          = "eu-west-3"
  owner               = "test-local"
  state_bucket_name   = "taskboard-test-local-etat"
}

run "etat_prive_versionne_chiffre" {
  command = plan
  assert {
    condition     = aws_s3_bucket_public_access_block.state.block_public_acls && aws_s3_bucket_public_access_block.state.ignore_public_acls && aws_s3_bucket_public_access_block.state.block_public_policy && aws_s3_bucket_public_access_block.state.restrict_public_buckets
    error_message = "Les quatre protections contre l'accès public doivent être actives."
  }
  assert {
    condition     = one(aws_s3_bucket_ownership_controls.state.rule).object_ownership == "BucketOwnerEnforced"
    error_message = "Les ACL doivent être désactivées au profit du propriétaire du bucket."
  }
  assert {
    condition     = one(aws_s3_bucket_versioning.state.versioning_configuration).status == "Enabled"
    error_message = "Le versionnement doit permettre la récupération d'un état antérieur."
  }
  assert {
    condition     = one(one(aws_s3_bucket_server_side_encryption_configuration.state.rule).apply_server_side_encryption_by_default).sse_algorithm == "AES256"
    error_message = "Le stockage de l'état doit activer SSE-S3."
  }
  assert {
    condition     = !aws_s3_bucket.state.force_destroy
    error_message = "Le bootstrap ne doit pas purger automatiquement les états et leurs versions."
  }
  assert {
    condition     = jsondecode(aws_s3_bucket_policy.tls.policy).Statement[0].Effect == "Deny" && jsondecode(aws_s3_bucket_policy.tls.policy).Statement[0].Condition.Bool["aws:SecureTransport"] == "false" && jsondecode(aws_s3_bucket_policy.tls.policy).Statement[0].Principal == "*" && jsondecode(aws_s3_bucket_policy.tls.policy).Statement[0].Action == "s3:*" && toset(jsondecode(aws_s3_bucket_policy.tls.policy).Statement[0].Resource) == toset(["arn:aws:s3:::${var.state_bucket_name}", "arn:aws:s3:::${var.state_bucket_name}/*"])
    error_message = "La politique doit refuser les accès non chiffrés en transit."
  }
}

run "refus_compte_different" {
  command = plan
  variables {
    expected_account_id = "999999999999"
  }
  expect_failures = [data.aws_caller_identity.current]
}

run "refus_nom_bucket_invalide" {
  command = plan
  variables {
    state_bucket_name = "INVALID.bucket"
  }
  expect_failures = [var.state_bucket_name]
}

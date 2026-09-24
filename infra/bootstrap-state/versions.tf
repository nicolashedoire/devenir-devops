terraform {
  required_version = "= 1.12.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.66.0"
    }
  }
  # État local d'amorçage à protéger et sauvegarder séparément du bucket créé.
  backend "local" {}
}

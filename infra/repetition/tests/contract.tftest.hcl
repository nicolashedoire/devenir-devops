# Plan réel du provider local ; aucun fichier créé par cette suite.
run "fichier_local_uniquement" {
  command = plan
  assert {
    condition     = local_file.environment.filename == "./run/environnement.json"
    error_message = "La répétition doit rester dans son dossier run/."
  }
  assert {
    condition     = jsondecode(local_file.environment.content).scope == "repetition-locale-sans-aws"
    error_message = "Le fichier doit annoncer explicitement son périmètre local."
  }
  assert {
    condition     = local_file.environment.file_permission == "0600"
    error_message = "Le fichier doit rester lisible uniquement par son propriétaire."
  }
}

run "environnement_invalide" {
  command = plan
  variables {
    environment = ""
  }
  expect_failures = [var.environment]
}

variable "environment" {
  description = "Nom de l'environnement fictif inscrit dans le fichier local."
  type        = string
  default     = "lab"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,19}$", var.environment))
    error_message = "Utiliser un nom de 2 à 20 caractères minuscules, chiffres ou tirets."
  }
}

variable "owner" {
  description = "Alias pédagogique sans donnée sensible."
  type        = string
  default     = "apprenant"
  validation {
    condition     = length(trimspace(var.owner)) > 0 && length(var.owner) <= 64
    error_message = "L'alias doit contenir entre 1 et 64 caractères."
  }
}

resource "local_file" "environment" {
  filename = "${path.module}/run/environnement.json"
  content = "${jsonencode({
    project     = "taskboard"
    environment = var.environment
    owner       = var.owner
    scope       = "repetition-locale-sans-aws"
  })}\n"
  file_permission      = "0600"
  directory_permission = "0700"
}

output "environment_file" {
  description = "Chemin du seul fichier créé par la répétition."
  value       = local_file.environment.filename
}

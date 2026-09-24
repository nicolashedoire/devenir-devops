variable "expected_account_id" {
  description = "Compte AWS de laboratoire attendu ; aucune valeur par défaut ni déduction depuis l'identité active."
  type        = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.expected_account_id)) && var.expected_account_id != "000000000000"
    error_message = "Indiquer explicitement le compte de laboratoire attendu, sur 12 chiffres."
  }
}

variable "aws_region" {
  description = "Région AWS commerciale, identique à celle prévue pour le backend."
  type        = string
  default     = "eu-west-3"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[1-9][0-9]*$", var.aws_region))
    error_message = "Utiliser une région commerciale AWS telle que eu-west-3."
  }
}

variable "project" {
  description = "Projet fixe du parcours ; conserver la même identité pour le backend et les fondations."
  type        = string
  default     = "taskboard"
  validation {
    condition     = var.project == "taskboard"
    error_message = "Ce parcours utilise project=taskboard et la clé taskboard/lab/foundations.tfstate."
  }
}

variable "environment" {
  description = "Ce module pédagogique ne prend en charge que l'environnement lab."
  type        = string
  default     = "lab"
  validation {
    condition     = var.environment == "lab"
    error_message = "Ce parcours est limité à lab ; une production demande une autre conception."
  }
}

variable "owner" {
  description = "Alias de la personne responsable du laboratoire et de son retrait, sans secret."
  type        = string
  validation {
    condition     = length(trimspace(var.owner)) > 0 && length(var.owner) <= 64
    error_message = "Renseigner un responsable de 1 à 64 caractères."
  }
}

variable "tags" {
  description = "Tags supplémentaires non sensibles. Les tags de responsabilité imposés restent prioritaires."
  type        = map(string)
  default     = {}
  validation {
    condition = length(var.tags) <= 35 && alltrue([
      for key, value in var.tags : length(key) > 0 && length(key) <= 128 && length(value) <= 256 && !startswith(lower(key), "aws:")
    ])
    error_message = "Prévoir au plus 35 tags, sans préfixe aws:, avec clés <=128 et valeurs <=256 caractères."
  }
}

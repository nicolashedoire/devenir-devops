# Tous les appels AWS sont remplacés. Même command=apply ne crée rien dans AWS.
mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:role/mock-lab"
      user_id    = "mock-lab"
    }
  }
  mock_data "aws_availability_zones" {
    defaults = {
      names = ["eu-west-3a", "eu-west-3b", "eu-west-3c"]
    }
  }
}

variables {
  expected_account_id = "123456789012"
  aws_region          = "eu-west-3"
  owner               = "test-local"
  availability_zones  = ["eu-west-3a", "eu-west-3b"]
}

run "inventaire_avant_creation" {
  command = plan
  assert {
    condition     = length(aws_subnet.public) + length(aws_subnet.private) == 4
    error_message = "La revue du premier plan doit contenir les quatre sous-réseaux prévus."
  }
}

run "reseau_deux_zones_sans_sortie_privee" {
  command = apply
  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.private) == 2 && length(distinct([for subnet in aws_subnet.private : subnet.availability_zone])) == 2
    error_message = "Prévoir deux sous-réseaux publics et deux privés dans deux zones distinctes."
  }
  assert {
    condition     = length(distinct(concat([for subnet in aws_subnet.public : subnet.cidr_block], [for subnet in aws_subnet.private : subnet.cidr_block]))) == 4
    error_message = "Les quatre /24 calculés doivent être distincts."
  }
  assert {
    condition     = alltrue([for subnet in merge({ for key, subnet in aws_subnet.public : "public-${key}" => subnet }, { for key, subnet in aws_subnet.private : "private-${key}" => subnet }) : !subnet.map_public_ip_on_launch])
    error_message = "Aucun sous-réseau ne doit attribuer automatiquement d'IPv4 publique."
  }
  assert {
    condition     = alltrue([for table in aws_route_table.private : length(table.route) == 0]) && length(aws_default_route_table.closed.route) == 0
    error_message = "Les tables privées et par défaut doivent exclure toute route sortante ajoutée."
  }
  assert {
    condition     = length(aws_route_table.public.route) == 1 && one(aws_route_table.public.route).cidr_block == "0.0.0.0/0" && one(aws_route_table.public.route).gateway_id == aws_internet_gateway.public.id
    error_message = "La seule route Internet doit être celle de la table publique vers l'IGW."
  }
  assert {
    condition     = alltrue([for key, association in aws_route_table_association.private : association.subnet_id == aws_subnet.private[key].id && association.route_table_id == aws_route_table.private[key].id])
    error_message = "Chaque sous-réseau privé doit utiliser explicitement sa table privée."
  }
  assert {
    condition     = toset(aws_db_subnet_group.private.subnet_ids) == toset(values(output.private_subnet_ids))
    error_message = "Le placement de la future base doit utiliser exclusivement les sous-réseaux privés."
  }
  assert {
    condition     = length(aws_default_security_group.closed.ingress) == 0 && length(aws_default_security_group.closed.egress) == 0
    error_message = "Le groupe par défaut du nouveau VPC doit rester fermé."
  }
  assert {
    condition     = aws_vpc_security_group_ingress_rule.database_from_app.from_port == 5432 && aws_vpc_security_group_ingress_rule.database_from_app.to_port == 5432 && aws_vpc_security_group_ingress_rule.database_from_app.ip_protocol == "tcp" && aws_vpc_security_group_ingress_rule.database_from_app.referenced_security_group_id == aws_security_group.app.id && aws_vpc_security_group_ingress_rule.database_from_app.security_group_id == aws_security_group.database.id && aws_vpc_security_group_ingress_rule.database_from_app.cidr_ipv4 == null && aws_vpc_security_group_ingress_rule.database_from_app.cidr_ipv6 == null
    error_message = "L'entrée PostgreSQL doit référencer le groupe applicatif, jamais un CIDR public."
  }
  assert {
    condition     = aws_vpc_security_group_egress_rule.app_to_database.from_port == 5432 && aws_vpc_security_group_egress_rule.app_to_database.to_port == 5432 && aws_vpc_security_group_egress_rule.app_to_database.ip_protocol == "tcp" && aws_vpc_security_group_egress_rule.app_to_database.security_group_id == aws_security_group.app.id && aws_vpc_security_group_egress_rule.app_to_database.referenced_security_group_id == aws_security_group.database.id && aws_vpc_security_group_egress_rule.app_to_database.cidr_ipv4 == null && aws_vpc_security_group_egress_rule.app_to_database.cidr_ipv6 == null
    error_message = "L'application ne doit déclarer que la sortie PostgreSQL ciblée."
  }
  assert {
    condition     = aws_vpc.main.tags["Owner"] == "test-local" && aws_vpc.main.tags["Environment"] == "lab" && output.expected_vpc_name == "taskboard-lab-vpc"
    error_message = "Le VPC doit rester attribuable et son tag Name déterministe pour le diagnostic."
  }
}

run "refus_compte_different" {
  command = plan
  variables {
    expected_account_id = "999999999999"
  }
  expect_failures = [data.aws_caller_identity.current]
}

run "refus_compte_mal_forme" {
  command = plan
  variables {
    expected_account_id = "compte-absent"
  }
  expect_failures = [var.expected_account_id]
}

run "refus_deux_fois_la_meme_zone" {
  command = plan
  variables {
    availability_zones = ["eu-west-3a", "eu-west-3a"]
  }
  expect_failures = [var.availability_zones]
}

run "refus_zone_indisponible" {
  command = plan
  variables {
    availability_zones = ["eu-west-3a", "eu-west-3z"]
  }
  expect_failures = [aws_vpc.main]
}

run "refus_reseau_public" {
  command = plan
  variables {
    vpc_cidr = "8.8.0.0/16"
  }
  expect_failures = [var.vpc_cidr]
}

run "refus_environnement_production" {
  command = plan
  variables {
    environment = "production"
  }
  expect_failures = [var.environment]
}

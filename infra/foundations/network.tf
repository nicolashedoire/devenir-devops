variable "availability_zones" {
  description = "Deux zones distinctes et disponibles dans le compte/région ; leur ordre fait partie de la configuration."
  type        = list(string)
  validation {
    condition     = length(var.availability_zones) == 2 && length(distinct(var.availability_zones)) == 2 && alltrue([for zone in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-[1-9][0-9]*[a-z]$", zone))])
    error_message = "Fournir exactement deux zones AWS standard distinctes, par exemple eu-west-3a et eu-west-3b."
  }
}

variable "vpc_cidr" {
  description = "Réseau privé IPv4 /16 canonique ; quatre /24 distincts seront calculés à l'intérieur."
  type        = string
  default     = "10.42.0.0/16"
  validation {
    condition     = can(regex("^(10\\.[0-9]{1,3}|172\\.(1[6-9]|2[0-9]|3[01])|192\\.168)\\.0\\.0/16$", var.vpc_cidr)) && can(cidrhost(var.vpc_cidr, 0))
    error_message = "Choisir un /16 privé canonique : 10.x.0.0/16, 172.16–31.0.0/16 ou 192.168.0.0/16."
  }
}

data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "zone-type"
    values = ["availability-zone"]
  }
}

locals {
  zones = {
    for index, zone in var.availability_zones : tostring(index) => {
      name         = zone
      public_cidr  = cidrsubnet(var.vpc_cidr, 8, index)
      private_cidr = cidrsubnet(var.vpc_cidr, 8, index + 10)
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.common_tags, { Name = "${local.name}-vpc" })
  depends_on           = [data.aws_caller_identity.current]
  lifecycle {
    precondition {
      condition     = terraform.workspace == "default"
      error_message = "Ce laboratoire utilise uniquement le workspace default et sa clé d'état explicite."
    }
    precondition {
      condition     = alltrue([for zone in var.availability_zones : contains(data.aws_availability_zones.available.names, zone)])
      error_message = "Une zone demandée n'est pas disponible dans le compte et la région actifs."
    }
  }
}

resource "aws_internet_gateway" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "${local.name}-igw" })
}

resource "aws_subnet" "public" {
  for_each                = local.zones
  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.value.name
  cidr_block              = each.value.public_cidr
  map_public_ip_on_launch = false
  tags                    = merge(local.common_tags, { Name = "${local.name}-public-${each.key}" })
}

resource "aws_subnet" "private" {
  for_each                = local.zones
  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.value.name
  cidr_block              = each.value.private_cidr
  map_public_ip_on_launch = false
  tags                    = merge(local.common_tags, { Name = "${local.name}-private-${each.key}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.public.id
  }
  tags = merge(local.common_tags, { Name = "${local.name}-public" })
}

resource "aws_route_table" "private" {
  for_each = local.zones
  vpc_id   = aws_vpc.main.id
  # [] gère explicitement l'absence de route ajoutée. La route locale AWS subsiste.
  route = []
  tags  = merge(local.common_tags, { Name = "${local.name}-private-${each.key}" })
}

resource "aws_route_table_association" "public" {
  for_each       = local.zones
  subnet_id      = aws_subnet.public[each.key].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  for_each       = local.zones
  subnet_id      = aws_subnet.private[each.key].id
  route_table_id = aws_route_table.private[each.key].id
}

# Seules les valeurs par défaut du NOUVEAU VPC sont prises en gestion.
resource "aws_default_route_table" "closed" {
  default_route_table_id = aws_vpc.main.default_route_table_id
  route                  = []
  tags                   = merge(local.common_tags, { Name = "${local.name}-default-closed" })
}

resource "aws_default_security_group" "closed" {
  vpc_id  = aws_vpc.main.id
  ingress = []
  egress  = []
  tags    = merge(local.common_tags, { Name = "${local.name}-default-closed" })
}

resource "aws_security_group" "app" {
  name_prefix = "${local.name}-app-"
  description = "Future application privee ; aucune entree publique"
  vpc_id      = aws_vpc.main.id
  tags        = merge(local.common_tags, { Name = "${local.name}-app" })
  # Pas de règle inline : les règles séparées ci-dessous sont la source unique.
}

resource "aws_security_group" "database" {
  name_prefix = "${local.name}-database-"
  description = "Future base privee ; PostgreSQL seulement depuis le groupe applicatif"
  vpc_id      = aws_vpc.main.id
  tags        = merge(local.common_tags, { Name = "${local.name}-database" })
}

resource "aws_vpc_security_group_ingress_rule" "database_from_app" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL depuis le seul groupe applicatif"
  tags                         = local.common_tags
}

resource "aws_vpc_security_group_egress_rule" "app_to_database" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.database.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL vers le seul groupe base de donnees"
  tags                         = local.common_tags
}

# Métadonnée de placement uniquement : aucune instance RDS n'est créée.
resource "aws_db_subnet_group" "private" {
  name        = "${local.name}-private"
  description = "Placement futur de PostgreSQL dans deux zones privees"
  subnet_ids  = [for subnet in aws_subnet.private : subnet.id]
  tags        = merge(local.common_tags, { Name = "${local.name}-database-subnets" })
}

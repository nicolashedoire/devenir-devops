output "vpc_id" {
  description = "VPC du laboratoire ; seule cible de l'incident de tag prévu."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Sous-réseaux avec route Internet, mais sans attribution automatique d'IPv4 publique."
  value       = { for key, subnet in aws_subnet.public : key => subnet.id }
}

output "private_subnet_ids" {
  description = "Sous-réseaux sans route Internet ni NAT, un par zone."
  value       = { for key, subnet in aws_subnet.private : key => subnet.id }
}

output "app_security_group_id" {
  description = "Groupe sans entrée publique, avec la seule sortie PostgreSQL vers le groupe base."
  value       = aws_security_group.app.id
}

output "database_security_group_id" {
  description = "Groupe autorisant PostgreSQL depuis le groupe applicatif uniquement."
  value       = aws_security_group.database.id
}

output "database_subnet_group_name" {
  description = "Préfiguration du placement RDS privé, sans instance RDS."
  value       = aws_db_subnet_group.private.name
}

output "expected_vpc_name" {
  description = "Valeur déclarée du tag Name pour la répétition de dérive."
  value       = aws_vpc.main.tags["Name"]
}

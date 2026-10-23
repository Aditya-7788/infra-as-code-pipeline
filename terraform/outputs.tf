output "vpc_id" {
  value = module.networking.vpc_id
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.networking.private_subnet_ids
}

output "alb_sg_id" {
  value = module.security.alb_sg_id
}

output "ecs_sg_id" {
  value = module.security.ecs_sg_id
}

output "task_execution_role_arn" {
  value = module.security.task_execution_role_arn
}

output "ecr_repository_url" {
  value = module.compute.ecr_repository_url
}

output "alb_dns_name" {
  value = module.compute.alb_dns_name
}

output "cluster_name" {
  value = module.compute.cluster_name
}

output "service_name" {
  value = module.compute.service_name
}

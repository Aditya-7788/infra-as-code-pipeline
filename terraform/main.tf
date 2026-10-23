data "aws_availability_zones" "available" {
  state = "available"
}

module "networking" {
  source             = "./modules/networking"
  project            = var.project
  environment        = var.environment
  azs                = slice(data.aws_availability_zones.available.names, 0, 2)
  enable_nat_gateway = var.enable_nat_gateway
}

module "security" {
  source      = "./modules/security"
  project     = var.project
  environment = var.environment
  vpc_id      = module.networking.vpc_id
}

module "monitoring" {
  source      = "./modules/monitoring"
  project     = var.project
  environment = var.environment
}

module "compute" {
  source                  = "./modules/compute"
  project                 = var.project
  environment             = var.environment
  region                  = var.region
  vpc_id                  = module.networking.vpc_id
  public_subnet_ids       = module.networking.public_subnet_ids
  alb_sg_id               = module.security.alb_sg_id
  ecs_sg_id               = module.security.ecs_sg_id
  task_execution_role_arn = module.security.task_execution_role_arn
  log_group_name          = module.monitoring.log_group_name
}

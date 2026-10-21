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

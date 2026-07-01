module "vpc" {

  source = "../../modules/vpc"

  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
}

module "ecr" {
  source = "../../modules/ecr"

  environment = var.environment
}

module "eks" {

  source = "../../modules/eks"

  environment = var.environment

  cluster_name = "dev-brainbox-eks"

  private_subnet_ids = module.vpc.private_subnet_ids
}
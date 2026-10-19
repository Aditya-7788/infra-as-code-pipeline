# terraform/variables.tf
variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "dev, staging or prod"
}

variable "project" {
  type    = string
  default = "infra-as-code-pipeline"
}
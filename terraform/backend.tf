# terraform/backend.tf
terraform {
  backend "s3" {
    bucket         = "infra-as-code-pipeline-tfstate-aditya-001"
    key            = "app/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "infra-as-code-pipeline-tflock"
    encrypt        = true
  }
}
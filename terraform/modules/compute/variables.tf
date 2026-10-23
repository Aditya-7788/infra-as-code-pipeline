variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "alb_sg_id" {
  type = string
}

variable "ecs_sg_id" {
  type = string
}

variable "task_execution_role_arn" {
  type = string
}

variable "log_group_name" {
  type = string
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "app_version" {
  type    = string
  default = "v1"
}

variable "cpu" {
  type    = number
  default = 256
}

variable "memory" {
  type    = number
  default = 512
}

variable "min_capacity" {
  type    = number
  default = 2
}

variable "max_capacity" {
  type    = number
  default = 6
}

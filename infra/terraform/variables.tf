
variable "aws_region" {
  type        = string
  description = "AWS Deployment Region"
  default     = "ap-southeast-1"
}

variable "environment" {
  type        = string
  description = "Environment name (dev or prod)"
  default     = "prod"
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "volume_size" {
  type    = number
  default = 30
}

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # S3 Remote State Backend an toàn & bảo mật
  backend "s3" {
    bucket         = "coderpush-terraform-states-ap-southeast-1"
    key            = "option-1-single-web-ec2/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "coderpush-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-default-x86_64"]
  }
}

module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
}

module "security" {
  source      = "./modules/security"
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
}

module "iam" {
  source      = "./modules/iam"
  environment = var.environment
}


resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = module.vpc.public_subnet_id
  vpc_security_group_ids = [module.security.web_security_group_id]
  iam_instance_profile   = module.iam.instance_profile_name

  root_block_device {
    volume_size           = var.volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = <<-EOF
              #!/bin/bash
              dnf update -y
              dnf install -y nodejs npm
              mkdir -p /opt/app
              cat << 'APP' > /opt/app/server.js
              const express = require('express');
              const app = express();
              app.get('/', (req, res) => res.send('Option 1 Standalone Web'));
              app.listen(80, () => console.log('Port 80'));
              APP
              node /opt/app/server.js &
              EOF

  tags = {
    Name        = "${var.environment}-web-server"
    Environment = var.environment
  }
}

resource "aws_eip" "web" {
  instance = aws_instance.web.id
  domain   = "vpc"

  tags = {
    Name        = "${var.environment}-web-eip"
    Environment = var.environment
  }
}

output "website_url" {
  value = "http://${aws_eip.web.public_ip}"
}


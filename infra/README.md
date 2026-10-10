# Infrastructure Modules - option-1-single-web-ec2

This directory contains standalone AWS CloudFormation modules supporting both **Development (`dev`)** and **Production (`prod`)** environments.

## 1. Module Structure
- `modules/vpc-subnets.yaml`: Provisions VPC, Internet Gateway, 2 Public Subnets (ALB), and 2 Private Subnets (Multi-AZ ASG).
- `modules/security-groups.yaml`: Manages Security Groups for ALB (ports 80/443) and Web EC2 instances (port 80 restricted to ALB SG).
- `modules/iam-roles.yaml`: Configures EC2 IAM Instance Profile with AWS SSM Session Manager and Amazon ECR ReadOnly access.
- `modules/app.yaml`: Provisions compute resources (Launch Template, Auto Scaling Group, ALB, Target Group, CloudFront Distribution).

## 2. Environment Configuration
- `environments/dev.json`: Cost-optimized parameters for Development (t3.micro, 1–2 instances, smaller EBS volume).
- `environments/prod.json`: High-availability & performance configuration for Production (t3.small/medium, 2–6 instances Multi-AZ, 30GB EBS).

## 3. Deployment Commands
```bash
# Deploy to Development:
./deploy.sh dev

# Deploy to Production:
./deploy.sh prod
```

# Deployment Guide - Option 1: Auto Scaling Web Application on EC2 with CloudFront

This guide provides end-to-end instructions for deploying the AWS CloudFormation infrastructure and containerized Next.js web application for **Option 1: Auto Scaling Web Application on EC2 with CloudFront Caching**.

---

## 1. Prerequisites

Ensure the following tools and access permissions are configured on your local machine or CI/CD runner:

- **AWS CLI v2**: Installed and configured (`aws configure`) with valid credentials having administrator privileges or permissions across CloudFormation, EC2, VPC, ELBv2, Auto Scaling, CloudFront, ECR, CloudWatch, and IAM.
- **Docker Engine**: Docker 24.x+ or Docker Desktop for building container images.
- **Node.js**: Node.js 20.x LTS or newer.
- **Python 3**: Python 3.10+ (used by deployment helper scripts to parse environment parameter files).
- **cfn-lint** *(optional)*: For validating CloudFormation templates (`pip install cfn-lint`).

---

## 2. Infrastructure Code Structure

All infrastructure code resides under the `infra/` directory:

```text
infra/
├── cloudformation.yaml      # Consolidated single-file CloudFormation template
├── deploy.sh                # Automated multi-stack deployment script
├── environments/
│   ├── dev.json             # Environment parameters for Development
│   └── prod.json            # Environment parameters for Production
└── modules/
    ├── vpc-subnets.yaml     # Module 1: VPC, IGW, Public Subnets (2 AZs), Private Subnets (2 AZs)
    ├── security-groups.yaml # Module 2: Security Groups for ALB and EC2 Web Tier
    ├── iam-roles.yaml       # Module 3: EC2 IAM Role & Instance Profile (SSM, ECR ReadOnly)
    └── app.yaml             # Module 4: ALB, Target Group, Auto Scaling Group, Launch Template, CloudFront
```

---

## 3. Environment Parameter Configuration

Configuration files are located in `infra/environments/dev.json` and `infra/environments/prod.json`.

| Parameter | Dev Value | Prod Value | Description |
| :--- | :--- | :--- | :--- |
| `EnvironmentName` | `dev` | `prod` | Prefix for naming and tagging AWS resources |
| `InstanceType` | `t3.micro` | `t3.small` / `t3.medium` | EC2 instance sizing |
| `MinInstances` | `1` | `2` | Minimum instances in Auto Scaling Group |
| `MaxInstances` | `2` | `6` | Maximum instances in Auto Scaling Group |
| `DesiredInstances` | `1` | `2` | Initial target instance count |
| `WebVolumeSize` | `20` | `30` | Root EBS volume size in GB (gp3 encrypted) |
| `LogRetentionDays` | `14` | `30` | CloudWatch log retention period in days |

---

## 4. Automated Deployment via GitHub Actions (CI/CD)

The repository includes a production-ready CI/CD pipeline defined in `.github/workflows/ci-cd.yml`.

### Required GitHub Repository Secrets:
Navigate to **Settings** -> **Secrets and variables** -> **Actions** and add:
- `AWS_ACCESS_KEY_ID`: IAM user/role access key ID.
- `AWS_SECRET_ACCESS_KEY`: IAM user/role secret access key.
- `AWS_REGION`: AWS Region (default: `ap-southeast-1`).
- `INFRACOST_API_KEY`: *(Optional)* API key for automated Infracost cost scanning.

### Branching & Deployment Workflow:
1. **`dev` Branch (Feature & Development):**
   - Triggers on push / PR to `dev`.
   - Runs unit tests (`test/test_api.js`) and lints CloudFormation templates (`cfn-lint`).
   - Builds the Next.js Docker image and pushes it to Amazon ECR tagged as `dev-latest`.
   - Runs Infracost to audit infrastructure expenses.
2. **`main` Branch (Production Delivery):**
   - Protected branch (**Branch Protection Rules** require PR and approval from `dev`).
   - Builds the production image and pushes to ECR tagged as `latest`.
   - Executes `deploy.sh prod latest` to update CloudFormation stacks.
   - Triggers **ASG Instance Refresh** to perform a rolling container deployment with zero downtime.

---

## 5. Manual Deployment via AWS CLI & `deploy.sh`

### Step 1: Build and Push Docker Image to Amazon ECR

Before launching the infrastructure stacks, the Docker image must be available in ECR so newly provisioned EC2 instances can pull and run the application container during initialization:

```bash
# Set configuration variables
export AWS_REGION="ap-southeast-1"
export ENV="dev" # or prod
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REPO_NAME="${ENV}-option-1-web-app"
export IMAGE_TAG="dev-latest" # or latest for prod

# Ensure ECR repository exists
aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
aws ecr create-repository --repository-name "$REPO_NAME" --region "$AWS_REGION"

# Log in Docker to Amazon ECR
aws ecr get-login-password --region "$AWS_REGION" | \
docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build and push container image
cd app
docker build -t "$REPO_NAME:$IMAGE_TAG" .
docker tag "$REPO_NAME:$IMAGE_TAG" "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"
docker push "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"
cd ..
```

### Step 2: Execute Infrastructure Deployment Script

```bash
cd infra
chmod +x deploy.sh

# Deploy to Development
./deploy.sh dev dev-latest

# Deploy to Production
./deploy.sh prod latest
```

The script executes the 4 stacks in dependency order:
1. `${ENV}-network`: Provisions VPC, Subnets, Internet Gateway, and Route Tables.
2. `${ENV}-security-groups`: Creates ALB and EC2 Security Groups with strict ingress rules.
3. `${ENV}-iam`: Configures the EC2 Instance Profile with SSM and ECR read-only policies.
4. `${ENV}-app`: Deploys the Application Load Balancer, Launch Template, Auto Scaling Group, and CloudFront CDN distribution.
5. Invokes `aws autoscaling start-instance-refresh` to initiate a rolling update.

---

## 6. Custom Domain & DNS Configuration

After CloudFormation finishes, retrieve the CloudFront domain name:

```bash
aws cloudformation describe-stacks \
  --stack-name dev-app \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" \
  --output text
```

In your DNS provider (e.g. Cloudflare, Amazon Route 53):
- **Record Type:** `CNAME`
- **Name/Host:** `opt1-dev` (for Dev) or `opt1` (for Prod)
- **Target Value:** `<distribution-id>.cloudfront.net`
- **Proxy Status:** **DNS Only (Grey Cloud ☁️)** — disables third-party CDN proxies to allow native AWS CloudFront caching and ACM certificate validation.

---

## 7. Zero-Downtime Rolling Update (Instance Refresh)

To deploy an updated application version without service downtime:
1. Build and push the new Docker image to ECR with the appropriate tag.
2. Trigger the Auto Scaling Instance Refresh:
   ```bash
   aws autoscaling start-instance-refresh \
     --auto-scaling-group-name "dev-opt1-asg" \
     --preferences '{"MinHealthyPercentage": 50, "InstanceWarmup": 180}'
   ```
3. The Auto Scaling Group launches new instances with the updated container, waits for the ALB Target Group health check on `/api/health` to succeed, and then drains and terminates old instances.

---

## 8. Infrastructure Teardown & Resource Cleanup

To prevent unnecessary costs when tearing down environments:

```bash
ENV="dev" # or prod

# Delete CloudFormation stacks in reverse dependency order
aws cloudformation delete-stack --stack-name "${ENV}-app"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-app"

aws cloudformation delete-stack --stack-name "${ENV}-iam"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-iam"

aws cloudformation delete-stack --stack-name "${ENV}-security-groups"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-security-groups"

aws cloudformation delete-stack --stack-name "${ENV}-network"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-network"

echo "✅ Teardown complete for environment: $ENV"
```

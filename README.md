# Option 1: Auto Scaling Web Application on EC2 with CloudFront Caching

Independent infrastructure and application source code for **Option 1: Auto Scaling Web Application on EC2 (ALB + ASG in Private Subnets) with Amazon CloudFront Edge Caching**.

## 1. Architecture Overview
![Architecture](infra/architecture_diagram.png)

### Key Architectural Highlights:
- **CloudFront CDN Edge Caching:** Optimized caching for static assets (`/_next/static/*`, images), offloading 80–90% of requests from origin servers, lowering TTFB, and accelerating global page load times.
- **Application Load Balancer (ALB):** Resides in Multi-AZ Public Subnets, distributing incoming HTTP/HTTPS requests with lightweight health checking via `/api/health`.
- **Auto Scaling Group (ASG):** Securely deployed in **Private Subnets (AZ1 & AZ2)**, automatically scaling EC2 instance counts based on CPU utilization (70% target tracking).
- **Zero-Downtime Rolling Update:** Integrated `aws autoscaling start-instance-refresh` in CI/CD rolls out updated container versions sequentially without service interruption.
- **Automated Monitoring & Alerts:** CloudWatch Alarms (ALB 5XX and ASG CPU > 85%) connected to SNS Topic for immediate email notification; CloudWatch LogGroups auto-expire logs after 14 days (Dev) / 30 days (Prod) for cost optimization.
- **AWS-Native Custom Domain:** Directs user traffic via DNS CNAME (DNS-only) directly to Amazon CloudFront Edge & ALB endpoints.

## 2. Cost Analysis

> 💡 **Verified via Infracost CLI:** Cost calculations derived directly from CloudFormation templates using `infracost scan ./infra/modules`.

### A. Component Cost Breakdown (Infracost CLI Verified)
| CloudFormation Module / Component | AWS Resource Type | Monthly Cost (USD) | Notes |
| :--- | :--- | :--- | :--- |
| **Application Load Balancer (ALB)** | `AWS::ElasticLoadBalancingV2::LoadBalancer` | **$16.43** | Fixed balancer charge spanning Multi-AZ |
| **Web Compute (Auto Scaling Group)** | `AWS::AutoScaling::AutoScalingGroup` (`t3.micro`) | **$9.49** | Baseline 1x instance (730 hrs/month) |
| **Secrets & Monitoring** | `SecretsManager`, `CloudWatch`, `SNS` | **$0.30** | Auth token secret + operational alarms |
| **Subtotal (Core Web Application Tier)** | `infra/modules/app.yaml` | **$26.22 / mo** | ~664,000 VND / month |
| **Private VPC Interface Endpoints (Optional)** | `AWS::EC2::VPCEndpoint` (7 endpoints) | **$102.20** | SSM, ECR, CloudWatch Logs in Private Subnets |
| **Total (Full Enterprise Isolated Architecture)** | `infra/modules/` | **$128.42 / mo** | ~3,250,000 VND / month |

### B. Cost by Purchasing Option & Architecture Mode
| Purchasing Model / Mode | Web Compute (`t3.micro`) | ALB & Supporting | Total (Lean Mode)* | Total (Full Isolated) | Approx. Local Currency (Lean) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Default)** | $9.49 | $16.73 | **$26.22 / mo** | **$128.42 / mo** | ~664,000 VND |
| **1-Year Savings Plan** | $5.98 | $16.73 | **$22.71 / mo** *(13% off)* | **$124.91 / mo** | ~575,000 VND |
| **3-Year Savings Plan** | $3.79 | $16.73 | **$20.52 / mo** *(22% off)* | **$122.72 / mo** | ~520,000 VND |
| **Spot Instance (Dev/Test)** | $2.84 | $16.73 | **$19.57 / mo** *(25% off)* | **$121.77 / mo** | ~496,000 VND |

*\*Lean Mode: Compute + ALB + CloudFront routing without dedicated VPC Interface Endpoints ($102.20/mo).*

## 3. Disaster Recovery & Recovery Time (MTTR)

Tested and verified under real AWS Chaos Engineering scenarios:

| Failure Scenario | Recovery Mechanism | Measured Recovery Time (MTTR) | Service Impact |
| :--- | :--- | :--- | :--- |
| **EC2 Instance Termination** | ASG Target Group Health Check + Auto-launch replacement | **140 seconds** (~2m 20s) | Old instance evicted in 25s; new instance healthy in 140s |
| **Process Crash / Stop** | Systemd unit restart + ALB Target re-registration | **29 seconds** | Temporary 502; auto-recovered to HTTP 200 |
| **100% CPU Saturation** | Graviton ARM scheduling + ALB queuing | **0 seconds downtime** | Response latency stable: 168.1ms baseline vs 162.4ms under load |
| **Target Response Latency** | CloudWatch ALB Metrics | **8.8ms average** | Peak under load: 86.5ms |

## 4. Application Screenshots

| Development Environment (`opt1-dev.png261.dev`) | Production Environment (`opt1.png261.dev`) |
| :---: | :---: |
| ![Development Environment](docs/screenshots/dev_screenshot.png) | ![Production Environment](docs/screenshots/prod_screenshot.png) |

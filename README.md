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

### A. Cost by Purchasing Option (Singapore Region: `ap-southeast-1`)
| Purchasing Model | EC2 Compute | Supporting Components (ALB + CloudFront + EBS) | Total Monthly Cost | Approx. Local Currency (VND) |
| :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Default)** | $15.18 / mo | $18.50 / mo | **$33.68 / mo** | ~850,000 VND |
| **1-Year Savings Plan (1-Yr Commitment)** | $9.56 / mo | $18.50 / mo | **$28.06 / mo** *(17% savings)* | ~708,000 VND |
| **3-Year Savings Plan (3-Yr Commitment)** | $6.06 / mo | $18.50 / mo | **$24.56 / mo** *(27% savings)* | ~620,000 VND |
| **Spot Instance (Dev/Test Environments)** | $4.53 / mo | $18.50 / mo | **$23.03 / mo** *(32% savings)* | ~581,000 VND |

### B. Cross-Region Cost Comparison
- **Singapore (`ap-southeast-1`):** $33.68 / month (Lowest latency to Southeast Asia & Vietnam: ~30ms).
- **US East (`us-east-1`):** $29.50 / month (Lower compute and ALB pricing, global edge delivery).
- **Tokyo (`ap-northeast-1`):** $38.20 / month (Higher compute pricing).

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

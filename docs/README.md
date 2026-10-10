# Technical Documentation - Option 1: Auto Scaling Web Application on EC2 with CloudFront

Welcome to the technical documentation for **Option 1: Auto Scaling Web Application on EC2 (ALB + ASG in Private Subnets) with Amazon CloudFront Edge Caching**.

This `docs/` folder provides comprehensive guides covering architecture, infrastructure deployment, local development, system operations, and troubleshooting.

---

## 📚 Documentation Index

1. [Deployment Guide](./deployment-guide.md)
   - Prerequisites & Required Tools
   - Environment Configuration (`dev.json` & `prod.json`)
   - Automated CI/CD Pipeline (GitHub Actions)
   - Manual Deployment via AWS CLI & `deploy.sh`
   - Custom Domain & DNS Mapping (`png261.dev`)
   - Zero-Downtime Rolling Update (ASG Instance Refresh)
   - Infrastructure Teardown & Resource Cleanup

2. [Operations & Usage Guide](./operations-guide.md)
   - Local Development & Testing (`npm run dev`, API tests)
   - Local Docker Container Validation
   - Remote Instance Management via AWS Systems Manager (SSM)
   - Monitoring & Observability (CloudWatch Logs, Metrics & Alarms)
   - Auto Scaling Operations & Capacity Planning
   - Troubleshooting & Frequently Encountered Issues

---

## 🏛️ Architecture Overview

Option 1 provides a high-availability, cost-effective infrastructure pattern designed for stateless web applications with dynamic traffic demands:

```
[Users / Browsers]
        │
        ▼ (HTTPS / DNS CNAME)
[Amazon CloudFront CDN] ────── (Edge Caching for /_next/static/*)
        │ (Forward Dynamic Requests)
        ▼
[Application Load Balancer (ALB)] ── (Public Subnets AZ1 & AZ2)
        │
        ▼ (Port 80 / Target Group Health Check: /api/health)
[Auto Scaling Group (ASG)] ───────── (Private Subnets AZ1 & AZ2)
        ├── EC2 Web Instance 1 (Docker Container)
        └── EC2 Web Instance 2 (Docker Container)
```

### Key Architectural Highlights:
- **CloudFront CDN Edge Caching:** Caches static assets (`/_next/static/*`, images) globally across AWS Edge locations, offloading 80–90% of requests from the backend servers.
- **Application Load Balancer (ALB):** Spans two Public Subnets across multiple Availability Zones, terminating TLS/HTTPS and routing traffic to healthy EC2 targets.
- **Auto Scaling Group (ASG):** Securely deployed within **Private Subnets**, automatically scaling EC2 instances based on CPU utilization (70% target tracking).
- **Stateless Web Tier:** Completely decoupled from stateful storage, allowing seamless horizontal scaling and zero-downtime rolling updates.
- **Zero-Downtime Instance Refresh:** Uses `aws autoscaling start-instance-refresh` to roll out new container versions progressively with automatic health verification.

---

## ⚡ Quick Start

### 1. Run the Web Application Locally
```bash
cd app
npm install
npm run dev
# Open http://localhost:3000 in your browser
```

### 2. Deploy Infrastructure to Development Environment
```bash
cd infra
chmod +x deploy.sh
./deploy.sh dev
```

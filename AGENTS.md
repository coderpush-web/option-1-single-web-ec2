# AGENTS.md — Option 1: Hosting 1 Web Application on Single EC2

## 1. Project Overview
This repository implements **Option 1**: A stateless Web Application (Next.js) running on a **single Amazon EC2 instance**, managed by an Auto Scaling Group (ASG), positioned behind an Application Load Balancer (ALB) and Amazon CloudFront CDN.

This architecture is optimized for stateless web applications, SSR frontends, and static sites communicating with external APIs or third-party serverless backends (e.g., Supabase, Firebase).

---

## 2. Repository Layout
```
option-1-single-web-ec2/
├── app/                          # Next.js 14 application codebase
│   ├── app/                      # Next.js App Router (pages & API routes)
│   ├── Dockerfile                # Multi-stage production container build
│   └── package.json              # Application dependencies & build scripts
├── infra/
│   ├── environments/             # Environment parameters (dev.json, prod.json)
│   └── modules/                  # CloudFormation templates
│       ├── vpc-subnets.yaml      # Multi-AZ VPC, subnets, and VPC endpoints
│       ├── security-groups.yaml  # ALB SG and Web SG definitions
│       └── app.yaml              # ALB, CloudFront, ASG, Launch Template
├── .github/workflows/            # CI/CD workflows (OIDC deployment, ECR build, lint)
├── .husky/ & .githooks/          # Quality gates: commit-msg, pre-commit, pre-push
├── test/test_api.js              # Automated Node.js API and healthcheck test suite
└── AGENTS.md                     # Agent guide for Option 1
```

---

## 3. Essential Commands

### Build & Run
- **Install Dependencies:** `npm install` (root) or `cd app && npm install`
- **Build Container:** `docker build -t nextjs-app:latest app/`
- **Run Application Locally:** `cd app && npm run dev`

### Validation & Quality Gates
- **Run Automated Tests:**
  ```bash
  node test/test_api.js
  ```
- **Lint CloudFormation Templates:**
  ```bash
  cfn-lint infra/modules/*.yaml
  ```
- **Scan IaC Security (Checkov):**
  ```bash
  checkov --config-file .checkov.yaml
  ```
- **Scan for Secrets (GitLeaks):**
  ```bash
  gitleaks protect --staged --verbose
  ```
- **Run All Pre-Commit Checks:**
  ```bash
  ./.husky/pre-commit
  ```

---

## 4. Architecture Requirements to Create

### 4.1. Network & Isolation Layer
- **Multi-AZ VPC:** 2 Public Subnets (for ALB) and 2 Private Subnets (for Web EC2).
- **Subnet Placement:** Web EC2 instance must reside strictly in Private Subnets with no public IPv4 address.
- **VPC Endpoints:** Private interface endpoints for AWS Systems Manager (`ssm`, `ssmmessages`, `ec2messages`), ECR (`ecr.api`, `ecr.dkr`), and CloudWatch (`logs`).
- **Management Access:** Server administration strictly via **AWS Systems Manager (SSM) Session Manager**. Do NOT open SSH port 22 to the internet.

### 4.2. Edge & Load Balancing Layer
- **Amazon CloudFront:**
  - Public TLS v1.2/v1.3 entry point using AWS Certificate Manager (ACM).
  - Injects custom origin header `X-CloudFront-Origin-Verify`.
  - Caches static assets (`/_next/static/*`) and enforces HTTPS redirect.
- **Application Load Balancer (ALB):**
  - Resides in public subnets.
  - Listener rule validates `X-CloudFront-Origin-Verify`. Direct traffic returns `HTTP 403 Forbidden`.
  - Target Group forwards traffic to EC2 port 3000 with health checks on `/api/health`.

### 4.3. Compute & Auto-Healing Layer
- **EC2 Instance:** 1x `t4g.small` Graviton ARM instance.
- **Auto Scaling Group (ASG):**
  - Capacity: `Min=1, Max=1, Desired=1`.
  - Tied to ALB Target Group health checks for auto-healing. If the instance becomes unhealthy, ASG terminates and replaces it.
- **Launch Template & Bootstrapping:** Amazon Linux 2023 UserData script installs Docker, pulls image from Amazon ECR, and runs container on port 3000.

---

## 5. Operational Boundaries & Guardrails

### 🛑 Never Do
- **Never Use Static AWS Keys:** Hardcoded `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is strictly prohibited. GitHub Actions must authenticate solely via AWS IAM OIDC (`secrets.AWS_ROLE_TO_ASSUME`).
- **Never Open Port 22:** Inbound SSH from `0.0.0.0/0` is forbidden.
- **Never Bypass Origin Verification:** ALB must reject requests lacking `X-CloudFront-Origin-Verify`.

### ⚠️ Ask First
- Changing instance type from Graviton ARM (`t4g`) to x86_64.
- Modifying ALB health check thresholds or paths.

### ✅ Always Do
- Follow Conventional Commits format (`type(scope): message`).
- Verify that `test/test_api.js`, `cfn-lint`, `checkov`, and `gitleaks` pass before pushing.

---

## 6. Technical Conventions & Standards
- **Health Endpoint:** Application must expose `/api/health` returning `200 OK` with JSON `{ "status": "healthy" }`.
- **Security Groups:** All ingress rules must contain explicit `Description` fields.
- **Containerization:** Next.js standalone output mode (`output: 'standalone'`) running as non-root user `nextjs`.

---

## 7. Definition of Done (Verification Checklist)
Before completing any task in this repository, verify:
1. [ ] `cfn-lint infra/modules/*.yaml` exits with code 0.
2. [ ] `checkov --config-file .checkov.yaml` runs cleanly.
3. [ ] `gitleaks protect --staged --verbose` finds 0 secrets.
4. [ ] `node test/test_api.js` passes all tests.
5. [ ] Workflows contain zero static AWS keys (`! grep -rn --exclude="ci-infra.yml" "AWS_ACCESS_KEY_ID" .github/workflows/`).
6. [ ] Commit message conforms to Conventional Commits hook.

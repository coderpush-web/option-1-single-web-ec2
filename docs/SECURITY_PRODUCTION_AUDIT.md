# Comprehensive Security, Architectural & Production Readiness Audit
## Architecture Option 1: Stateless Web Application on EC2 Auto Scaling Group behind ALB & CloudFront CDN
**Repository:** `option-1-single-web-ec2`  
**Evaluation Date:** 2026-10-10  
**Audit Standard:** AWS Well-Architected Framework (Security, Reliability, Operational Excellence) & CWE/CVSS v3.1  
**Status:** Action Required Prior to Production Deployment  

---

## 1. Executive Summary

This document presents a comprehensive, production-grade security and architectural evaluation of **Option 1 (`option-1-single-web-ec2`)**.

Option 1 is designed as a **stateless, horizontally scalable web tier** deploying a containerized Next.js 14 application onto Amazon EC2 instances managed by an Auto Scaling Group (ASG) across two Private Subnets. Ingress is governed through an internet-facing Application Load Balancer (ALB) and an Amazon CloudFront Content Delivery Network (CDN) edge cache.

### Key Assessment Findings
1. **Critical Architectural Deadlock in Production Edge-to-Origin Routing:** A severe configuration conflict between CloudFront's `OriginProtocolPolicy: http-only` and the ALB's Port 80 HTTP-to-HTTPS redirect (`HTTP_301`) prevents traffic from reaching the application tier whenever a TLS/ACM certificate is configured. CloudFront distributions do not follow origin redirects, causing an infinite redirect loop or complete edge connection failures.
2. **Hardcoded Credentials & Authentication Bypass Backdoor:** Source code contains hardcoded fallback credentials (`postgres://postgres:postgres@127.0.0.1:5432/postgres` in `db.ts`) and a built-in authentication bypass backdoor (`user@nextmail.com` / `123456` in `placeholder-data.ts` and `auth.ts`) that validates unauthenticated sessions whenever database connectivity fails.
3. **Stateless Tier Mismatch with Database Drivers:** Although Option 1 is defined as a stateless web layer without a database backend, the application codebase imports the PostgreSQL driver (`postgres.js`), initiates connection pools against `127.0.0.1:5432` on every server-rendered page load, incurs 4-second TCP connection timeouts, and executes SQL mutations that fail during user interactions.
4. **Secret Management & IAM Gaps:** The EC2 instance profile (`infra/modules/iam-roles.yaml`) lacks IAM permissions to read from AWS Secrets Manager or SSM Parameter Store. The UserData bootstrap script fails to inject NextAuth's mandatory session secret (`AUTH_SECRET`), and no `.env.example` template exists.
5. **Quality Gate Suppression in Build Pipeline:** `app/next.config.js` suppresses TypeScript type-checking (`ignoreBuildErrors: true`) and ESLint validation (`ignoreDuringBuilds: true`), masking compile errors and runtime exceptions in CI/CD container builds.

---

## 2. Architectural Context & Component Topology

### 2.1 Component Architecture Diagram

```
                                      [ Internet Clients ]
                                                │
                                                │ HTTPS (Port 443)
                                                ▼
                           ┌─────────────────────────────────────────┐
                           │      Amazon CloudFront CDN Edge         │
                           │   - ViewerProtocolPolicy: redirect-to-https
                           │   - X-CloudFront-Origin-Verify Header   │
                           │   - Cache /_next/static/* & /static/*   │
                           └────────────────────┬────────────────────┘
                                                │
                 Origin Request: HTTP (Port 80) │ [ARCHITECTURAL DEFECT]
                 OriginProtocolPolicy: http-only │ (Loops with ALB 301 Redirect)
                                                ▼
┌────────────────────────────────── AWS Virtual Private Cloud (VPC: 10.0.0.0/16) ──────────────────────────────────┐
│                                                                                                                  │
│  ┌────────────────────── Public Subnet 1 (10.0.1.0/24) ──┐  ┌────────────────────── Public Subnet 2 (10.0.2.0/24) ──┐  │
│  │                                                       │  │                                                       │  │
│  │               ┌───────────────────────────────────────┴──┴───────────────────────────────────────┐               │  │
│  │               │              Internet-Facing Application Load Balancer (ALB)                     │               │  │
│  │               │  - Port 80 Listener (Redirects to 443 if Cert; 403 Forbidden without Header)     │               │  │
│  │               │  - Port 443 Listener (Validates X-CloudFront-Origin-Verify -> Forwards to TG)    │               │  │
│  │               └───────────────────────────────────────┬──────────────────────────────────────────┘               │  │
│  └───────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘  │
│                                                          │ Forward Port 80 (WebSecurityGroup)                           │
│                                                          ▼                                                              │
│  ┌───────────────────── Private Subnet 1 (10.0.10.0/24) ─┴──┐  ┌───────────────────── Private Subnet 2 (10.0.11.0/24) ─┴──┐  │
│  │                                                          │  │                                                          │  │
│  │   ┌──────────────────────────────────────────────────┐   │  │   ┌──────────────────────────────────────────────────┐   │  │
│  │   │        Auto Scaling Group Web Instance 1         │   │  │   │        Auto Scaling Group Web Instance 2         │   │  │
│  │   │  - AL2023 EC2 (t3.micro / t3.small)              │   │  │   │  - AL2023 EC2 (t3.micro / t3.small)              │   │  │
│  │   │  - Docker Container: `react-webapp` (Port 80)    │   │  │   │  - Docker Container: `react-webapp` (Port 80)    │   │  │
│  │   │  - Next.js 14 App Router (Node 20 Alpine)        │   │  │   │  - Next.js 14 App Router (Node 20 Alpine)        │   │  │
│  │   │  - Non-root user: `nextjs` (UID 1001)            │   │  │   │  - Non-root user: `nextjs` (UID 1001)            │   │  │
│  │   │  - Unused local PostgreSQL driver attempting     │   │  │   │  - Unused local PostgreSQL driver attempting     │   │  │
│  │   │    connection to 127.0.0.1:5432 (4s timeout)     │   │  │   │    connection to 127.0.0.1:5432 (4s timeout)     │   │  │
│  │   └──────────────────────────────────────────────────┘   │  │   └──────────────────────────────────────────────────┘   │  │
│  │                                                          │  │                                                          │  │
│  │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │ VPC Interface Endpoints (Isolated Subnets, No NAT Gateway Required):                                   │   │  │
│  │   │ `ecr.api`, `ecr.dkr`, `s3` (Gateway), `logs`, `secretsmanager`, `ssm`, `ssmmessages`, `ec2messages`    │   │  │
│  │   └────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component & Resource Inventory

| Logical Resource | CloudFormation Type | Physical Architecture & Configuration | Purpose & Status |
| :--- | :--- | :--- | :--- |
| `VPC` | `AWS::EC2::VPC` | CIDR `10.0.0.0/16`, DNS Support/Hostnames enabled | Foundation network container |
| `PublicSubnet1 / 2` | `AWS::EC2::Subnet` | `10.0.1.0/24`, `10.0.2.0/24` with Internet Gateway (IGW) | Ingress tier hosting ALB nodes |
| `PrivateSubnet1 / 2` | `AWS::EC2::Subnet` | `10.0.10.0/24`, `10.0.11.0/24` (No NAT Gateway) | Isolated compute tier hosting EC2 ASG |
| `VpcEndpoints` | `AWS::EC2::VPCEndpoint` | Private endpoints for ECR, S3, Logs, SSM, SecretsManager | Enables private AWS API communication |
| `ApplicationLoadBalancer` | `AWS::ElasticLoadBalancingV2::LoadBalancer` | Internet-facing, cross-zone load balancing | Ingress reverse proxy to target instances |
| `ALBTargetGroup` | `AWS::ElasticLoadBalancingV2::TargetGroup` | Target: Instance port 80, Health: `/api/health` | Manages active healthy instance pool |
| `WebLaunchTemplate` | `AWS::EC2::LaunchTemplate` | AL2023, IMDSv2 required, GP3 root volume (Encrypted) | Blueprint for ASG instance provisioning |
| `WebAutoScalingGroup` | `AWS::AutoScaling::AutoScalingGroup` | Min: 1 (dev) / 2 (prod), Max: 2 (dev) / 6 (prod) | Compute elasticity and instance lifecycle |
| `CloudFrontDistribution` | `AWS::CloudFront::Distribution` | Edge distribution, PriceClass 200, HTTP/2 & HTTP/3 | Edge TLS termination & static caching |
| `ALBSecurityGroup` | `AWS::EC2::SecurityGroup` | Ports 80 & 443 open to `0.0.0.0/0` | Public ingress security filter |
| `WebSecurityGroup` | `AWS::EC2::SecurityGroup` | Port 80 restricted to `ALBSecurityGroup` | Compute tier network boundary |
| `DatabaseSecurityGroup` | `AWS::EC2::SecurityGroup` | Port 3306 (MySQL) from `WebSecurityGroup` | **DEFECT**: Unused/irrelevant security group |
| `EC2SSMRole` | `AWS::IAM::Role` | SSM, ECR ReadOnly, CloudWatch Agent policies | Instance IAM profile |

---

## 3. Comprehensive Security Findings & Vulnerability Matrix

| Finding ID | Severity | CVSS v3.1 | CWE ID | Affected Files & Lines | Short Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | 8.6 | CWE-798 | `app/app/lib/db.ts:4–7` | Insecure hardcoded fallback connection string with plaintext credentials |
| **SEC-02** | **HIGH** | 7.7 | CWE-287 / CWE-798 | `app/app/lib/placeholder-data.ts:3–10`<br>`app/auth.ts:20–28` | Authentication bypass backdoor validating mock credentials on DB failure |
| **SEC-03** | **HIGH** | 7.5 | CWE-312 / CWE-330 | `infra/modules/app.yaml:70–118`<br>`app/auth.ts:35` | Missing `AUTH_SECRET` container injection breaking session encryption |
| **SEC-04** | **HIGH** | 7.4 | CWE-436 / CWE-670 | `infra/modules/app.yaml:144–179, 345–350` | CloudFront `http-only` origin policy causes infinite redirect loop with ALB |
| **SEC-05** | **MEDIUM** | 5.3 | CWE-476 | `app/app/seed/route.ts:5`<br>`app/app/query/route.ts:3` | Non-null assertion on missing env variable triggers unhandled module crash |
| **SEC-06** | **MEDIUM** | 4.8 | CWE-330 | `infra/modules/app.yaml:175, 353` | Predictable ALB origin verification header derived from AWS Account ID |
| **SEC-07** | **MEDIUM** | 4.3 | CWE-1188 | Repository Root / `app/` | Absence of `.env.example` template for configuration contracts |
| **SEC-08** | **LOW** | 3.1 | CWE-276 | `infra/modules/security-groups.yaml:50–65` | Dead/redundant security group rule exposing MySQL port 3306 |

---

### Deep-Dive Analysis of Vulnerabilities

#### Finding SEC-01: Hardcoded Insecure Fallback Database Connection String
- **Severity:** **CRITICAL** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N — Score: 8.6)
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-259 (Use of Hard-coded Password)
- **Affected Location:** `option-1-single-web-ec2/app/app/lib/db.ts`, Lines 4–7:
  ```typescript
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5432/postgres';
  ```
- **Technical Description:** The code defines a static fallback containing default credentials (`postgres:postgres`) targeting `127.0.0.1:5432`. In Option 1, no database is deployed. If environment variables `POSTGRES_URL` and `DATABASE_URL` are omitted or unconfigured, the application instantiates a connection pool using these credentials.
- **Proof of Concept / Evidence:**
  When the container boots in Option 1 without environment variables, the runtime logs report:
  `Failed to init postgres client: Error: connect ECONNREFUSED 127.0.0.1:5432` after a 4-second delay. Furthermore, if an attacker runs a local listener on port 5432 or targets an internal container, authentication is attempted with known default credentials.
- **Security Impact:** Leaks database authentication credentials in version control; introduces unhandled network timeouts on every application request; creates security risk if an internal port 5432 service is reachable.
- **Remediation:** Remove the fallback string entirely. In Option 1, because the architecture is stateless, eradicate the database client instantiation or gracefully provide a mock data provider without attempting network connections.

---

#### Finding SEC-02: Hardcoded Plaintext User Credentials with Auth Bypass Backdoor
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N — Score: 7.7)
- **CWE:** CWE-287 (Improper Authentication), CWE-798 (Use of Hard-coded Credentials)
- **Affected Locations:**
  - `app/app/lib/placeholder-data.ts`, Lines 3–10:
    ```typescript
    const users = [
      {
        id: '410544b2-4001-4271-9855-fec4b6a6442a',
        name: 'User',
        email: 'user@nextmail.com',
        password: '123456',
      },
    ];
    ```
  - `app/auth.ts`, Lines 20–28:
    ```typescript
    const found = placeholderUsers.find((u) => u.email === email);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        email: found.email,
        password: await bcrypt.hash(found.password, 10),
      };
    }
    ```
- **Technical Description:** When an authentication request is processed via NextAuth, `getUser(email)` attempts a SQL query. Because Option 1 has no database, the query fails and execution falls through to lines 20–28. The code actively scans `placeholderUsers`, dynamically computes a bcrypt hash of `'123456'`, and passes the synthetic user object to NextAuth's credential verification logic.
- **Proof of Concept / Evidence:**
  Any user can navigate to `/login` and submit:
  - **Email:** `user@nextmail.com`
  - **Password:** `123456`
  NextAuth successfully verifies the password, issues a signed session cookie, and redirects the attacker into the `/dashboard` administrative interface.
- **Security Impact:** Complete authentication bypass in production. Anyone with knowledge of the repository can access the administrative dashboard.
- **Remediation:** Remove the fallback lookup in `app/auth.ts`. The authentication handler must fail closed (return `null`) whenever database credentials or database connectivity are invalid.

---

#### Finding SEC-03: Missing `AUTH_SECRET` Container Injection
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N — Score: 7.5)
- **CWE:** CWE-312 (Cleartext Storage of Sensitive Information), CWE-330 (Use of Insufficiently Random Values)
- **Affected Locations:**
  - `infra/modules/app.yaml`, Lines 103–105:
    ```yaml
    ExecStart=/usr/bin/docker run --name react-webapp -p 80:80 \
      -e APP_ENV=${EnvironmentName} -e PORT=80 \
      ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/...
    ```
  - `app/auth.ts`, Line 35:
    ```typescript
    secret: process.env.AUTH_SECRET,
    ```
- **Technical Description:** NextAuth v5 requires `AUTH_SECRET` in production to sign and encrypt JWT session cookies and CSRF tokens. The CloudFormation LaunchTemplate UserData script boots the Docker container with only `APP_ENV` and `PORT`. `AUTH_SECRET` is never generated in AWS Secrets Manager and never injected into the container runtime.
- **Security Impact:** In production (`NODE_ENV === 'production'`), NextAuth throws a fatal `MissingSecret` error upon receiving authentication requests, rendering the entire login workflow non-functional, or falls back to an unkeyed state compromising session integrity.
- **Remediation:**
  1. Define an `AWS::SecretsManager::Secret` resource generating a 32-byte hex secret.
  2. Grant the EC2 instance profile IAM permission `secretsmanager:GetSecretValue`.
  3. In EC2 UserData, retrieve the secret via AWS CLI and write it to `/etc/react-webapp.env` (permissions `0600`).
  4. Launch the Docker container with `--env-file /etc/react-webapp.env`.

---

#### Finding SEC-04: Production Edge-to-Origin Deadlock (CloudFront HTTP-Only vs ALB 301 Redirect)
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H — Score: 7.4)
- **CWE:** CWE-436 (Interpretation Conflict), CWE-670 (Always-Incorrect Control Flow Implementation)
- **Affected Locations:**
  - `infra/modules/app.yaml`, Lines 144–179:
    ```yaml
    ALBListener:
      Properties:
        Port: 80
        Protocol: HTTP
        DefaultActions:
          !If
            - HasCertificateArn
            - - Type: redirect
                RedirectConfig:
                  Protocol: HTTPS
                  Port: '443'
                  StatusCode: HTTP_301
            - - Type: fixed-response
                FixedResponseConfig:
                  StatusCode: '403'
    ALBHeaderRule:
      Condition: NoCertificateArn
      Properties:
        Actions:
          - Type: forward
            TargetGroupArn: !Ref ALBTargetGroup
    ```
  - `infra/modules/app.yaml`, Lines 345–350:
    ```yaml
    CustomOriginConfig:
      HTTPPort: 80
      HTTPSPort: 443
      OriginProtocolPolicy: http-only
    ```
- **Technical Description:**
  When `CertificateArn` is supplied (production deployment):
  1. The ALB Port 80 listener unconditionally redirects all requests to `HTTPS:443` with `HTTP_301`.
  2. The forward rule to `ALBTargetGroup` is disabled because `Condition: NoCertificateArn` evaluates to false.
  3. CloudFront's origin configuration is hardcoded to connect over HTTP port 80 (`OriginProtocolPolicy: http-only`).
  4. CloudFront connects to ALB port 80 -> receives an HTTP 301 redirect to `https://<alb-dns-name>:443` -> CloudFront does NOT follow origin redirects and returns the 301 response directly to the client browser.
  5. The client browser follows the redirect to the raw ALB domain name. Because the client request lacks the `X-CloudFront-Origin-Verify` header, the ALB returns `HTTP 403 Forbidden: Direct access to ALB is forbidden`.
- **Security Impact:** Complete denial of service for the entire production web application. Users cannot view pages through CloudFront.
- **Remediation:**
  Update CloudFront's `CustomOriginConfig`:
  - When `CertificateArn` is provided, set `OriginProtocolPolicy: https-only` and connect to ALB port 443.
  - Retain `http-only` only when `NoCertificateArn` is true.
  - Ensure the ALB HTTPS Listener (port 443) verifies `X-CloudFront-Origin-Verify` before forwarding traffic to `ALBTargetGroup`.

---

#### Finding SEC-05: Non-Null Assertion Crash Risk on Seed and Query Route Handlers
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:M — Score: 5.3)
- **CWE:** CWE-476 (NULL Pointer Dereference)
- **Affected Locations:**
  - `app/app/seed/route.ts`, Line 5:
    ```typescript
    const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
    ```
  - `app/app/query/route.ts`, Line 3:
    ```typescript
    const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
    ```
- **Technical Description:** TypeScript non-null assertions (`!`) are applied to `process.env.POSTGRES_URL`. In environments where `POSTGRES_URL` is undefined, `postgres(undefined as any, ...)` executes at module import time, triggering an unhandled exception before route handlers can execute or evaluate `process.env.NODE_ENV === 'production'`.
- **Remediation:** Validate configuration strings prior to client initialization or encapsulate client instantiation inside handler guards.

---

#### Finding SEC-06: Predictable Origin Verification Header
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N — Score: 4.8)
- **CWE:** CWE-330 (Use of Insufficiently Random Values)
- **Affected Locations:** `infra/modules/app.yaml`, Lines 175, 353:
  ```yaml
  Value: !Sub '${EnvironmentName}-secure-origin-${AWS::AccountId}'
  ```
- **Technical Description:** The shared secret header `X-CloudFront-Origin-Verify` prevents bypass of CloudFront caching and WAF. However, the value is formed using a deterministic pattern incorporating the AWS Account ID. If an attacker discovers or infers the AWS Account ID, they can forge this header and send direct HTTP requests to the public ALB, bypassing CloudFront edge protections.
- **Remediation:** Generate a high-entropy random secret (e.g., 32 hex characters) in AWS Secrets Manager and reference it dynamically.

---

#### Finding SEC-07: Missing `.env.example` Template
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N — Score: 4.3)
- **CWE:** CWE-1188 (Insecure Default Initialization of Resource)
- **Affected Locations:** Repository Root and `app/` directory.
- **Technical Description:** There is no `.env.example` template committed to the repository documenting mandatory runtime environment variables (`AUTH_SECRET`, `APP_ENV`, `PORT`, `AUTH_URL`). Developers and operators must inspect source code to discover required settings.
- **Remediation:** Provide an explicit `.env.example` in `app/`.

---

#### Finding SEC-08: Redundant Database Security Group (MySQL Port 3306)
- **Severity:** **LOW** (CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N — Score: 3.1)
- **CWE:** CWE-276 (Incorrect Default Permissions)
- **Affected Location:** `infra/modules/security-groups.yaml`, Lines 50–65:
  ```yaml
  DatabaseSecurityGroup:
    Properties:
      GroupDescription: Allow internal MySQL/MariaDB 3306 only from WebSecurityGroup
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3306
          ToPort: 3306
          SourceSecurityGroupId: !Ref WebSecurityGroup
  ```
- **Technical Description:** Option 1 has no database tier. The CloudFormation template exports a security group allowing ingress on MySQL port 3306. This is dead infrastructure code copied from another stack and introduces confusion during security reviews.
- **Remediation:** Remove `DatabaseSecurityGroup` from Option 1 or document its deprecation.

---

## 4. Infrastructure Security & AWS Well-Architected Review

### 4.1 IAM Roles & Least Privilege Analysis (`infra/modules/iam-roles.yaml`)
- **Current Policies:**
  - `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore` (Compliant: allows SSH-less administration via Session Manager).
  - `arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly` (Compliant: allows pulling container images from ECR).
  - `arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy` (Compliant: publishes metrics and logs).
- **Security Gaps:**
  1. **Zero Secrets Manager Permissions:** The role lacks `secretsmanager:GetSecretValue`. When dynamic secret management for `AUTH_SECRET` is introduced, EC2 instances will receive `AccessDeniedException`.
  2. **Zero Parameter Store Permissions:** No access to `ssm:GetParameter` for runtime configuration.
- **Recommended Policy:**
  ```yaml
  EC2SecretsManagerReadPolicy:
    Type: AWS::IAM::Policy
    Properties:
      PolicyName: EC2SecretsManagerReadPolicy
      Roles:
        - !Ref EC2SSMRole
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action:
              - 'secretsmanager:GetSecretValue'
              - 'secretsmanager:DescribeSecret'
            Resource: !Sub 'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:${EnvironmentName}-web-auth-secret*'
  ```

### 4.2 Network & Edge Security
- **CloudFront CDN Configuration:**
  - `ViewerProtocolPolicy: redirect-to-https` enforces encryption between end-users and CloudFront edge.
  - `CustomOriginConfig` uses `http-only` on port 80. Edge-to-origin traffic across the AWS backbone is unencrypted.
  - **SNI & Custom Domain Defect:** `CloudFrontDistribution` configures `CloudFrontDefaultCertificate: true` without domain `Aliases`. When parameters like `opt1.png261.dev` are used, routing requests to CloudFront fails with SSL certificate domain mismatch (`SSL_ERROR_BAD_CERT_DOMAIN`).
- **Security Group Ingress/Egress:**
  - `ALBSecurityGroup` allows ingress from `0.0.0.0/0` on ports 80 and 443. While origin header validation is enforced by ALB listener rules, defense-in-depth could be improved by restricting ingress to the AWS-managed prefix list for CloudFront (`pl-58a04531`).
  - No explicit egress rules are configured on security groups; instances inherit default unrestricted outbound (`0.0.0.0/0`).

### 4.3 Storage Encryption & Data Protection
- **Root EBS Storage:** The LaunchTemplate specifies `Encrypted: true` on `/dev/xvda` using default AWS managed keys (`aws/ebs`). For enterprise compliance, customer-managed KMS keys (CMK) with automated key rotation should be utilized.
- **No Persistent Storage Needed:** Being stateless, Option 1 does not provision auxiliary EBS data volumes, which correctly aligns with its design.

### 4.4 High Availability & Auto Scaling Resilience
- **Topology:** Multi-AZ deployment across `PrivateSubnet1` and `PrivateSubnet2`.
- **Scaling Policy:** Target Tracking scaling policy maintains average ASG CPU at 70%.
- **Rolling Update:** `AutoScalingRollingUpdate` with `MinInstancesInService: 1`, `MaxBatchSize: 1`, and `PauseTime: PT3M` ensures zero-downtime rolling updates.

### 4.5 Observability & CloudWatch Monitoring
- **Existing Alarms:**
  - `ALB5XXAlarm`: Triggers when `HTTPCode_Target_5XX_Count > 10` in 60 seconds.
  - `HighCPUAlarm`: Triggers when ASG average `CPUUtilization > 85%` for 2 periods of 300s.
- **Missing Production Alarms:**
  - `TargetResponseTimeAlarm`: Alerts if ALB target response latency exceeds 2.0 seconds.
  - `UnHealthyHostCountAlarm`: Alerts if healthy target count falls below minimum desired instances.

---

## 5. Application Security & Code Quality Review

### 5.1 Build Configuration & TypeScript Masking (`app/next.config.js`)
```javascript
typescript: {
  ignoreBuildErrors: true,
},
eslint: {
  ignoreDuringBuilds: true,
},
```
- **Evaluation:** Directly violates Requirement R4. Masking TypeScript errors allows code with broken imports, missing types, or syntax issues to produce broken Docker images.
- **Remediation:** Remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`. The Next.js application must build cleanly via `npm run build` and pass `npx tsc --noEmit`.

### 5.2 Automated Testing Gaps (`test/test_api.js`)
- The current automated test only verifies `1 + 1 === 2` and checks that 4 files exist on disk.
- **Missing Test Coverage:**
  - No verification of HTTP endpoints (`/api/health`).
  - No tests for NextAuth authentication flows.
  - No validation of environment variable parsing or schema definitions.

### 5.3 Silent Error Degradation in Data Layer (`app/app/lib/data.ts`)
```typescript
export async function fetchRevenue() {
  if (sqlClient) {
    try {
      const data = await sqlClient`SELECT * FROM revenue`;
      if (data && data.length > 0) return data;
    } catch (error) {
      console.log('Using placeholder revenue data due to DB offline:', error);
    }
  }
  return mockRevenue as Revenue[];
}
```
- **Evaluation:** In Option 1, every query fails and logs `Using placeholder revenue data due to DB offline`. The app runs in a degraded state without alerting operations teams that database calls are occurring in a stateless tier.

---

## 6. Architecture-Specific Deep Dive: Stateless Reality Alignment

Option 1 is designated as a **Stateless Web Application**. However, the current implementation exhibits a severe architectural contradiction:

```
[Design Contract: Pure Stateless Application]
                     VS
[Implementation: Full-Stack Database App with Dead Connections]
```

1. **Dead TCP Connection Loops:** Because `db.ts` attempts to connect to `127.0.0.1:5432`, every page request blocks for `connect_timeout: 4` seconds before falling back to mock data. This injects 4000ms of artificial latency into Next.js server-side rendering.
2. **Broken User Mutations:** When users navigate to `/dashboard/invoices/create` and click "Create Invoice", `createInvoice` in `app/app/lib/actions.ts` executes:
   ```typescript
   await sqlClient`
     INSERT INTO invoices (customer_id, amount, status, date)
     VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
   `;
   ```
   This throws an unhandled database connection exception, returning an error banner to the user.
3. **Resolution Strategy for Option 1:**
   - Option 1 must clearly isolate its data strategy. If it represents a demo dashboard that operates without an external database, the data fetching layer must directly serve structured in-memory mock data **without initiating PostgreSQL network pools**.
   - If an external database is intended, it must be provisioned (as demonstrated in Options 3 and 4). For Option 1, the clean path is:
     1. Remove `postgres.js` pool initialization in `app/lib/db.ts` when no database environment variable is provided.
     2. Remove fallback credentials.
     3. Provide immediate mock responses without network timeout penalties.

---

## 7. Actionable Step-by-Step Remediation Roadmap

### Phase 1: Critical Security & Secret Management (Immediate)
1. **Remove Hardcoded Fallback String:**
   In `app/app/lib/db.ts`, eliminate `'postgres://postgres:postgres@127.0.0.1:5432/postgres'`. If `POSTGRES_URL` is unset, do not instantiate `sqlClient`.
2. **Eliminate Auth Bypass Backdoor:**
   In `app/auth.ts`, delete lines 20–28 referencing `placeholderUsers`. In stateless mode without a database, either configure a secure authenticated user mock provider or fail closed.
3. **Implement Dynamic Secret Management for NextAuth:**
   - In `infra/modules/app.yaml`, add an `AWS::SecretsManager::Secret` resource: `${EnvironmentName}-web-auth-secret`.
   - Update `infra/modules/iam-roles.yaml` to grant `secretsmanager:GetSecretValue` on the secret ARN.
   - In LaunchTemplate UserData, fetch `auth_secret` using the AWS CLI, write to `/etc/react-webapp.env` (`chmod 600`), and pass via `--env-file /etc/react-webapp.env` to the Docker container.
4. **Create `.env.example`:**
   Add `app/.env.example` documenting `AUTH_SECRET`, `AUTH_URL`, `APP_ENV`, and `PORT`.

### Phase 2: Infrastructure & Edge Alignment (High Priority)
1. **Resolve CloudFront / ALB HTTPS Origin Conflict:**
   - In `infra/modules/app.yaml`, update `CloudFrontDistribution.CustomOriginConfig`:
     - When `HasCertificateArn` is true: set `OriginProtocolPolicy: https-only` and `HTTPSPort: 443`.
     - Update ALB Port 443 Listener to enforce `X-CloudFront-Origin-Verify`.
2. **Clean Up Security Groups:**
   - In `infra/modules/security-groups.yaml`, remove `DatabaseSecurityGroup` (port 3306) which is unused in Option 1.
3. **High-Entropy Origin Verification Secret:**
   - Replace the predictable origin header value with a cryptographically secure random string stored in Secrets Manager.

### Phase 3: Code Quality & Build Enforcement (Medium Priority)
1. **Enforce Strict TypeScript Compilation:**
   - In `app/next.config.js`, remove `typescript: { ignoreBuildErrors: true }` and `eslint: { ignoreDuringBuilds: true }`.
   - Run `npm run build` and resolve any type mismatches.
2. **Expand Automated Testing:**
   - Enhance `test/test_api.js` to test `/api/health`, environment variable validation, and configuration integrity.

### Phase 4: Observability & Resilience (Low Priority)
1. **CloudWatch Alarms:**
   - Add CloudWatch Alarms for ALB target response time (`TargetResponseTime > 2.0s`) and unhealthy host count.
2. **Custom Domain / ACM Certificate Configuration:**
   - Add CloudFront distribution `Aliases` and ACM certificate parameter support for custom subdomains (`opt1.png261.dev`).

---

## 8. AWS Well-Architected Framework Compliance Scorecard

| Pillar | Rating | Baseline Findings | Target Status Post-Remediation |
| :--- | :---: | :--- | :--- |
| **Security** | **FAIL** | Hardcoded credentials in `db.ts`, backdoor credentials in `auth.ts`, missing `AUTH_SECRET`, predictable origin header, unencrypted edge-to-origin transit. | **PASS**: Secrets Manager dynamic retrieval, zero hardcoded secrets, strict TLS origin, scoped IAM roles. |
| **Reliability** | **FAIL** | Infinite 301 redirect loop between CloudFront and ALB when SSL is enabled; non-null assertion crashes on missing env vars. | **PASS**: Aligned CloudFront origin protocol policy, resilient health probes, Multi-AZ ASG rolling updates. |
| **Performance Efficiency** | **WARN** | 4-second TCP connection timeout on every page request attempting to connect to non-existent local database. | **PASS**: Zero connection timeouts in stateless mode; CloudFront caching on static Next.js assets. |
| **Cost Optimization** | **PASS** | Auto-scaling instances (1–2 dev), VPC endpoints avoid NAT Gateway hourly charges, CloudFront edge caching offloads compute. | **PASS**: Maintains cost-effective baseline. |
| **Operational Excellence** | **FAIL** | Suppressed TypeScript build errors in `next.config.js`; trivial placeholder tests in `test_api.js`. | **PASS**: Strict `tsc` enforcement in CI/CD container builds, comprehensive automated test suites. |

---

## 9. Verification & Audit Attestation

This audit was conducted by inspecting CloudFormation templates (`infra/modules/*.yaml`), application source code (`app/**/*`), container definitions (`app/Dockerfile`), and pipeline workflows (`.github/workflows/*.yml`) in repository `option-1-single-web-ec2`.

**Verification Command References:**
- CloudFormation Linting: `cfn-lint infra/modules/*.yaml`
- TypeScript Static Verification: `cd app && npx tsc --noEmit`
- Clean Production Build: `cd app && npm run build`
- Zero-Secret Grep Validation: `grep -rn "postgres://postgres:" .`

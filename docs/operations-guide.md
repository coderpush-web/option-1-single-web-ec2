# Operations & Usage Guide - Option 1: Auto Scaling Web Application on EC2 with CloudFront

This guide explains how to run the web application locally, inspect and manage remote EC2 instances, monitor system health, and troubleshoot common operational issues.

---

## 1. Local Application Development

### Development Environment Setup:
```bash
cd app

# 1. Install Node.js dependencies
npm install

# 2. Start Next.js local development server with hot reload
npm run dev
```

The application will be accessible at: `http://localhost:3000`.

### Key Application Routes:
- `/`: Main dashboard home view.
- `/dashboard/invoices`: Invoice management interface with searching, pagination, and invoice status filters.
- `/dashboard/customers`: Customer directory and transaction overview.
- `/api/health`: Health check endpoint used by the Application Load Balancer Target Group. Returns `{"status":"ok"}` with HTTP status `200`.

### Running Automated Tests:
```bash
# Execute unit and API integration tests
node test/test_api.js
```

---

## 2. Local Docker Container Verification

Before pushing new images to Amazon ECR, you can build and verify the multi-stage Docker container locally:

```bash
cd app

# 1. Build the production container image
docker build -t nextjs-app:test .

# 2. Run the container locally mapping host port 3000 to container port 80
docker run -d --name test-container -p 3000:80 nextjs-app:test

# 3. Verify the health check endpoint
curl -I http://localhost:3000/api/health

# 4. View container runtime logs
docker logs test-container

# 5. Stop and clean up the container
docker stop test-container && docker rm test-container
```

---

## 3. Remote EC2 Management via AWS Systems Manager (SSM)

All EC2 instances in this architecture are located in **Private Subnets** without public IP addresses or inbound SSH port 22 open.

Administrative shell access is performed securely through **AWS Systems Manager Session Manager**:

### Connect to an EC2 Instance:
```bash
# 1. List active instances in the Auto Scaling Group
aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=dev-opt1-asg" "Name=instance-state-name,Values=running" \
  --query "Reservations[*].Instances[*].[InstanceId,PrivateIpAddress,State.Name]" \
  --output table

# 2. Start a secure interactive SSM shell session
aws ssm start-session --target <INSTANCE_ID>
```

### Useful Management Commands on the EC2 Host:
```bash
# Check status of the systemd service managing Docker
sudo systemctl status react-webapp

# View live container logs
sudo docker ps
sudo docker logs -f $(sudo docker ps -q)

# Inspect memory and CPU utilization
sudo docker stats --no-stream
htop

# Check cloud-init provisioning logs (if initial startup failed)
sudo cat /var/log/cloud-init-output.log
```

---

## 4. Monitoring & Observability

### A. Centralized Logging (CloudWatch Logs)
Container stdout/stderr logs and host system logs are published to Amazon CloudWatch:
- **Log Group:** `/aws/ec2/dev-opt1` (or `/aws/ec2/prod-opt1`)
- **Retention Period:** 14 days (Dev) / 30 days (Prod) to minimize log storage overhead.

Tail live logs using the AWS CLI:
```bash
aws logs tail /aws/ec2/dev-opt1 --follow --format short
```

### B. Metrics & Alarms (CloudWatch Alarms)
The infrastructure template includes automated CloudWatch alarms:
1. **ALB 5XX Errors Alarm:** Triggers if 5XX response codes exceed 10 occurrences in a 1-minute period.
2. **ASG High CPU Alarm:** Triggers if the average CPU utilization across the Auto Scaling Group exceeds 85% for 5 consecutive minutes.

Both alarms send automated incident notifications to the **Amazon SNS Topic** (`${EnvironmentName}-ops-alerts`), which delivers alert emails to designated engineers.

---

## 5. Capacity Management & Auto Scaling Operations

- **Scaling Metric:** Target tracking scaling policy aiming for an average 70% CPU utilization.
- **Development Capacity:** Min 1, Max 2 instances.
- **Production Capacity:** Min 2, Max 6 instances distributed evenly across Availability Zones.

### Manually Adjusting Capacity for High Traffic Events:
```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name prod-opt1-asg \
  --min-size 4 \
  --max-size 10 \
  --desired-capacity 4
```

---

## 6. Troubleshooting & Common Issues

### Issue 1: Target Group Marks Instances as Unhealthy (`502 Bad Gateway`)
- **Cause:** Application container failed to start, port 80 is not listening, or `/api/health` returned an error code.
- **Remediation:**
  1. Open an SSM session to the target instance.
  2. Verify whether the Docker container is running: `sudo docker ps -a`.
  3. Send a local curl request inside the instance: `curl -I http://localhost:80/api/health`.
  4. Inspect container error logs: `sudo docker logs $(sudo docker ps -q)`.

### Issue 2: CloudFront Serves Stale Assets After New Deployment
- **Cause:** Edge location caches retain static content according to cache header TTLs.
- **Remediation:** Invalidate the CloudFront distribution cache:
  ```bash
  DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='${ENV}-opt1-distribution'].Id" --output text)

  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*"
  ```

### Issue 3: EC2 Cannot Pull Images from ECR During Boot
- **Cause:** IAM Instance Profile is missing ECR read permissions or VPC route table lacks NAT Gateway access to ECR endpoints.
- **Remediation:**
  1. Verify the IAM role attached to the Launch Template has `AmazonEC2ContainerRegistryReadOnly`.
  2. Review the cloud-init bootstrap log on the host: `sudo cat /var/log/cloud-init-output.log`.

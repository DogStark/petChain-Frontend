# Load Testing Deployment Guide

## Local Development Setup

### 1. Install Dependencies

```bash
# Install k6
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install Node dependencies
cd load-testing
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Setup Test Data

```bash
npm run setup
```

### 4. Run Tests

```bash
npm run test:load
```

## CI/CD Setup

### GitHub Actions

The workflow is already configured in `.github/workflows/load-testing.yml`.

**Manual Trigger**:
1. Navigate to Actions tab
2. Select "Load Testing"
3. Click "Run workflow"
4. Select test type

**Scheduled Runs**:
- Automatically runs weekly on Sundays at 2 AM UTC

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
load-test:
  stage: test
  image: node:20
  services:
    - postgres:16-alpine
    - redis:7-alpine
  variables:
    POSTGRES_DB: petchain_test
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  before_script:
    - apt-get update && apt-get install -y gnupg
    - gpg -k
    - gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
    - echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | tee /etc/apt/sources.list.d/k6.list
    - apt-get update && apt-get install -y k6
    - cd backend && npm ci && npm run build
    - npm run start:prod &
    - sleep 10
    - cd ../load-testing && npm install
  script:
    - npm run test:load
  artifacts:
    paths:
      - load-testing/results/
    expire_in: 30 days
  only:
    - schedules
    - web
```

## Production Monitoring Setup

### 1. Deploy Monitoring Stack

```bash
# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002 (admin/admin)
- **Performance Dashboard**: http://localhost:3001

### 3. Configure Alerts

Edit `monitoring/alerts.yml` and restart Prometheus:

```bash
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

## Cloud Deployment

### AWS Setup

#### 1. Deploy Application

```bash
# Using ECS/Fargate
aws ecs create-service \
  --cluster petchain-cluster \
  --service-name petchain-backend \
  --task-definition petchain-backend:1 \
  --desired-count 3 \
  --launch-type FARGATE
```

#### 2. Configure Auto-Scaling

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/petchain-cluster/petchain-backend \
  --min-capacity 2 \
  --max-capacity 10

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/petchain-cluster/petchain-backend \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

#### 3. Set Up CloudWatch

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name PetChain-Performance \
  --dashboard-body file://cloudwatch-dashboard.json
```

### Kubernetes Setup

#### 1. Deploy Application

```bash
kubectl apply -f k8s/deployment.yml
kubectl apply -f k8s/service.yml
kubectl apply -f k8s/hpa.yml
```

#### 2. Configure HPA

```yaml
# k8s/hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: petchain-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: petchain-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Scheduled Load Testing

### Cron Job (Linux)

```bash
# Edit crontab
crontab -e

# Add weekly load test (Sunday 2 AM)
0 2 * * 0 cd /path/to/load-testing && npm run test:load >> /var/log/load-test.log 2>&1
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: load-test
spec:
  schedule: "0 2 * * 0"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: k6
            image: grafana/k6:latest
            command:
            - k6
            - run
            - /tests/load-test.js
            volumeMounts:
            - name: tests
              mountPath: /tests
          volumes:
          - name: tests
            configMap:
              name: k6-tests
          restartPolicy: OnFailure
```

## Monitoring Integration

### Prometheus Metrics

Add to backend:

```typescript
// metrics.controller.ts
@Controller('metrics')
export class MetricsController {
  @Get()
  getMetrics() {
    // Return Prometheus format metrics
    return register.metrics();
  }
}
```

### Grafana Dashboards

Import dashboards:
1. Open Grafana (http://localhost:3002)
2. Go to Dashboards → Import
3. Upload `monitoring/grafana/dashboards/*.json`

## Troubleshooting

### Tests Failing

```bash
# Check backend is running
curl http://localhost:3000/api/v1/health

# Check test users exist
npm run setup

# Check logs
tail -f ../backend/logs/*.log
```

### High Error Rates

```bash
# Check database connection
psql -h localhost -U postgres -d petchain_db -c "SELECT 1"

# Check Redis
redis-cli ping

# Check backend logs
docker logs petchain_backend
```

### Monitoring Not Working

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Restart monitoring stack
docker-compose -f docker-compose.monitoring.yml restart
```

## Maintenance

### Daily
- [ ] Check dashboard for anomalies
- [ ] Review error logs
- [ ] Monitor resource usage

### Weekly
- [ ] Run automated load tests
- [ ] Review test results
- [ ] Update performance baselines

### Monthly
- [ ] Review optimization opportunities
- [ ] Update alert thresholds
- [ ] Analyze trends
- [ ] Plan capacity upgrades

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [NestJS Performance](https://docs.nestjs.com/techniques/performance)

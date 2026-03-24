# Quick Start Guide

Get started with load testing in 5 minutes.

## Prerequisites

- Node.js 20+
- k6 installed
- PetChain backend running

## Installation

```bash
# 1. Install k6
# macOS
brew install k6

# Linux
curl https://github.com/grafana/k6/releases/download/v0.48.0/k6-v0.48.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.48.0-linux-amd64/k6 /usr/local/bin/

# 2. Install dependencies
cd load-testing
npm install

# 3. Build tests
npm run build

# 4. Configure environment
cp .env.example .env
# Edit .env with your settings

# 5. Setup test data
npm run setup
```

## Run Your First Test

```bash
# Start backend (if not running)
cd ../backend
npm run start:dev

# In another terminal, run load test
cd ../load-testing
npm run test:load
```

## View Results

```bash
# Analyze results
npm run analyze

# Or start dashboard
npm run dashboard
# Open http://localhost:3001
```

## What's Next?

1. **Review Results**: Check if performance meets thresholds
2. **Identify Issues**: Look for slow endpoints or errors
3. **Optimize**: Apply fixes from PERFORMANCE_OPTIMIZATION.md
4. **Re-test**: Run tests again to validate improvements
5. **Monitor**: Set up continuous monitoring

## Common Commands

```bash
# Run different test types
npm run test:load      # Baseline test
npm run test:stress    # Stress test
npm run test:api       # API endpoints

# Monitor in real-time
npm run monitor

# View dashboard
npm run dashboard

# Analyze results
npm run analyze
```

## Troubleshooting

**k6 not found**: Install k6 (see Installation above)

**Connection refused**: Ensure backend is running at http://localhost:3000

**Auth failed**: Run `npm run setup` to create test users

**Build errors**: Run `npm install` and `npm run build`

## Help

See full documentation:
- `README.md` - Overview
- `docs/TESTING_GUIDE.md` - Detailed testing guide
- `docs/BOTTLENECK_IDENTIFICATION.md` - Finding issues
- `docs/OPTIMIZATION_CHECKLIST.md` - Optimization steps

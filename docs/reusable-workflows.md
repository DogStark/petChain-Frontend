# Reusable Workflow Interface

This document describes the reusable GitHub Actions workflows and their interfaces.

## Overview

The CI/CD pipeline is composed of three reusable workflows:

1. **reusable-test.yml** - Test workflow for frontend and backend
2. **reusable-build.yml** - Build workflow for frontend, backend, and Docker
3. **reusable-deploy.yml** - Deploy workflow for different environments

## Reusable Test Workflow

**File:** `.github/workflows/reusable-test.yml`

### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `node-version` | string | No | `20` | Node.js version |
| `skip-frontend` | boolean | No | `false` | Skip frontend tests |
| `skip-backend` | boolean | No | `false` | Skip backend tests |
| `run-coverage` | boolean | No | `true` | Generate coverage reports |

### Outputs

| Output | Description |
|--------|-------------|
| `frontend-coverage` | Frontend coverage report path |
| `backend-coverage` | Backend coverage report path |

### Example Usage

```yaml
jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    with:
      node-version: '20'
      skip-frontend: false
      skip-backend: false
      run-coverage: true
```

## Reusable Build Workflow

**File:** `.github/workflows/reusable-build.yml`

### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `node-version` | string | No | `20` | Node.js version |
| `skip-frontend` | boolean | No | `false` | Skip frontend build |
| `skip-backend` | boolean | No | `false` | Skip backend build |
| `docker-registry` | string | No | `ghcr.io` | Docker registry |
| `docker-image-name` | string | No | `petchain-frontend` | Docker image name |
| `docker-tag` | string | No | `latest` | Docker image tag |
| `push-docker` | boolean | No | `false` | Push Docker image |

### Outputs

| Output | Description |
|--------|-------------|
| `docker-image` | Built Docker image URI |

### Example Usage

```yaml
jobs:
  build:
    uses: ./.github/workflows/reusable-build.yml
    with:
      node-version: '20'
      push-docker: true
      docker-tag: production-${{ github.sha }}
```

## Reusable Deploy Workflow

**File:** `.github/workflows/reusable-deploy.yml`

### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `environment` | string | Yes | - | Deployment environment (staging, production) |
| `node-version` | string | No | `20` | Node.js version |
| `use-production` | boolean | No | `false` | Use Vercel production environment |

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `VERCEL_TOKEN` | Yes | Vercel authentication token |
| `VERCEL_ORG_ID` | Yes | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Yes | Vercel project ID |

### Outputs

| Output | Description |
|--------|-------------|
| `url` | Deployed URL |

### Example Usage

```yaml
jobs:
  deploy:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      use-production: false
    secrets:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Caller Workflows

The repository includes the following caller workflows:

| Workflow | File | Description |
|----------|------|-------------|
| CI | `ci.yml` | Main CI pipeline (test + build) |
| Deploy Staging | `deploy-staging.yml` | Deploy to staging environment |
| Deploy Production | `deploy-production.yml` | Deploy to production environment |
| Deploy (Legacy) | `deploy.yml` | Legacy deploy workflow using reusable workflows |

## Action Version Pinning

All GitHub Actions are pinned to specific commit SHAs for security and reproducibility:

| Action | Pinned Version |
|--------|----------------|
| `actions/checkout` | `11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2) |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` (v4) |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` (v4) |
| `docker/setup-buildx-action` | `b5ca514318bd6ebac0fb2aedd5d36ec1b5c232a2` (v3.10.0) |
| `docker/login-action` | `74a5d142397b4f367a81961eba4e8cd7edddf772` (v3.4.0) |
| `docker/metadata-action` | `902fa8ec7d6ecbf8d84d538b9b233a880e428804` (v5.7.0) |
| `docker/build-push-action` | `14487ce63c7a62a4a324b0bfb37086795e31c6c1` (v6.16.0) |

## Environment Configuration

Each environment requires the following GitHub repository secrets:

### Staging
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Production
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Creating a New Caller Workflow

To create a new caller workflow for a custom environment:

1. Create a new file in `.github/workflows/` (e.g., `deploy-dev.yml`)
2. Use the `workflow_call` trigger to invoke reusable workflows
3. Configure the appropriate secrets for the environment

Example:

```yaml
name: Deploy to Dev

on:
  workflow_dispatch:

jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    with:
      run-coverage: false

  build:
    uses: ./.github/workflows/reusable-build.yml

  deploy:
    needs: [test, build]
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      use-production: false
    secrets:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

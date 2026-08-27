#!/bin/bash

# Build Verification Script for PetChain Frontend
# This script verifies that both frontend and backend build successfully

set -e  # Exit on error

echo "🚀 PetChain Build Verification"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check Node.js version
print_info "Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

if [ -f ".nvmrc" ]; then
    EXPECTED_VERSION=$(cat .nvmrc)
    print_info "Expected version from .nvmrc: v$EXPECTED_VERSION"
fi
echo ""

# Frontend Build Verification
echo "📦 Frontend Build Verification"
echo "--------------------------------"

print_info "Installing frontend dependencies..."
npm install --silent

print_info "Running TypeScript type check..."
npm run type-check

print_info "Running ESLint..."
npm run lint:check || npm run lint:fix

print_info "Checking code formatting..."
npm run format:check || npm run format

print_info "Building frontend..."
npm run build

print_success "Frontend build completed successfully!"
echo ""

# Backend Build Verification
echo "📦 Backend Build Verification"
echo "--------------------------------"

cd backend

print_info "Installing backend dependencies..."
npm install --silent

print_info "Building backend..."
npm run build

print_success "Backend build completed successfully!"
echo ""

cd ..

# Final Summary
echo "================================"
print_success "All builds completed successfully! ✨"
echo ""
echo "Next steps:"
echo "  - Frontend dev: npm run dev"
echo "  - Backend dev:  cd backend && npm run start:dev"
echo ""

#!/bin/bash

set -e

echo "🚀 Setting up Load Testing & Performance Optimization"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}⚠️  k6 not found. Installing...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install k6
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    else
        echo -e "${RED}❌ Unsupported OS. Please install k6 manually: https://k6.io/docs/get-started/installation/${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ k6 installed${NC}"
else
    echo -e "${GREEN}✅ k6 already installed${NC}"
fi

# Install load testing dependencies
echo ""
echo "📦 Installing load testing dependencies..."
cd load-testing
npm install

# Build TypeScript
echo ""
echo "🔨 Building TypeScript files..."
npm run build

# Create directories
echo ""
echo "📁 Creating directories..."
mkdir -p results reports

# Copy environment file
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit load-testing/.env with your configuration${NC}"
fi

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd ../backend
npm install

# Apply database optimizations
echo ""
echo "🗄️  Applying database optimizations..."
if command -v psql &> /dev/null; then
    read -p "Apply database optimizations now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        psql -d petchain_db -f src/database/scripts/optimize-database.sql
        echo -e "${GREEN}✅ Database optimizations applied${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql not found. Run manually: psql -d petchain_db -f backend/src/database/scripts/optimize-database.sql${NC}"
fi

# Setup monitoring (optional)
echo ""
read -p "Setup monitoring stack (Prometheus/Grafana)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd ..
    docker-compose -f docker-compose.monitoring.yml up -d
    echo -e "${GREEN}✅ Monitoring stack started${NC}"
    echo "   - Prometheus: http://localhost:9090"
    echo "   - Grafana: http://localhost:3002 (admin/admin)"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && npm run start:dev"
echo "2. Setup test data: cd load-testing && npm run setup"
echo "3. Run load test: npm run test:load"
echo "4. View dashboard: npm run dashboard"
echo ""
echo "For more information, see:"
echo "  - load-testing/QUICK_START.md"
echo "  - load-testing/README.md"
echo "  - PERFORMANCE_OPTIMIZATION.md"

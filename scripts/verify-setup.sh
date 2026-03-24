#!/bin/bash

echo "🔍 Verifying Load Testing Setup"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# Check k6
echo -n "Checking k6... "
if command -v k6 &> /dev/null; then
    echo -e "${GREEN}✅ Installed${NC}"
else
    echo -e "${RED}❌ Not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    VERSION=$(node --version)
    echo -e "${GREEN}✅ ${VERSION}${NC}"
else
    echo -e "${RED}❌ Not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check load-testing dependencies
echo -n "Checking load-testing dependencies... "
if [ -d "load-testing/node_modules" ]; then
    echo -e "${GREEN}✅ Installed${NC}"
else
    echo -e "${YELLOW}⚠️  Not installed${NC}"
    echo "   Run: cd load-testing && npm install"
fi

# Check if built
echo -n "Checking TypeScript build... "
if [ -d "load-testing/dist" ]; then
    echo -e "${GREEN}✅ Built${NC}"
else
    echo -e "${YELLOW}⚠️  Not built${NC}"
    echo "   Run: cd load-testing && npm run build"
fi

# Check backend
echo -n "Checking backend... "
if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${YELLOW}⚠️  Not running${NC}"
    echo "   Run: cd backend && npm run start:dev"
fi

# Check PostgreSQL
echo -n "Checking PostgreSQL... "
if command -v psql &> /dev/null; then
    if psql -h localhost -U postgres -d petchain_db -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot connect${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql not found${NC}"
fi

# Check Redis
echo -n "Checking Redis... "
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Running${NC}"
    else
        echo -e "${YELLOW}⚠️  Not running${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  redis-cli not found${NC}"
fi

# Check Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Installed${NC}"
else
    echo -e "${YELLOW}⚠️  Not found${NC}"
fi

# Check configuration
echo -n "Checking .env file... "
if [ -f "load-testing/.env" ]; then
    echo -e "${GREEN}✅ Exists${NC}"
else
    echo -e "${YELLOW}⚠️  Not found${NC}"
    echo "   Run: cp load-testing/.env.example load-testing/.env"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "Ready to run tests:"
    echo "  cd load-testing"
    echo "  npm run test:load"
else
    echo -e "${RED}❌ ${ERRORS} critical check(s) failed${NC}"
    echo "Please fix the issues above before running tests."
    exit 1
fi

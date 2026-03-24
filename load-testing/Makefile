.PHONY: help install build test clean

help:
	@echo "PetChain Load Testing Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install        Install dependencies"
	@echo "  make build          Build TypeScript files"
	@echo "  make setup          Setup test data"
	@echo ""
	@echo "Testing:"
	@echo "  make test-load      Run load test"
	@echo "  make test-stress    Run stress test"
	@echo "  make test-spike     Run spike test"
	@echo "  make test-soak      Run soak test"
	@echo "  make test-api       Run API endpoints test"
	@echo "  make test-auth      Run auth flow test"
	@echo "  make test-pets      Run pets workflow test"
	@echo "  make test-all       Run all tests"
	@echo ""
	@echo "Monitoring:"
	@echo "  make monitor        Start performance monitoring"
	@echo "  make dashboard      Start performance dashboard"
	@echo "  make analyze        Analyze test results"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          Clean build artifacts"

install:
	npm install

build:
	npm run build

setup:
	npm run setup

test-load:
	npm run test:load

test-stress:
	npm run test:stress

test-spike:
	npm run test:spike

test-soak:
	npm run test:soak

test-api:
	npm run test:api

test-auth:
	npm run test:auth

test-pets:
	npm run test:pets

test-database:
	npm run test:database

test-all:
	npm run test:all

monitor:
	npm run monitor

dashboard:
	npm run dashboard

analyze:
	npm run analyze

benchmark:
	npm run benchmark

clean:
	rm -rf dist/ results/ node_modules/

report:
	npm run report

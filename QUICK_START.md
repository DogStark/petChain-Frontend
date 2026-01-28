# 🚀 Quick Start Guide - Advanced Search System

## Overview

This guide will help you quickly get the advanced search system up and running.

## Prerequisites

- Node.js v18+
- Docker & Docker Compose
- Git

## 1. Install Dependencies

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
npm install
```

## 2. Start Docker Services

```bash
cd backend
docker-compose up -d
```

This starts:

- PostgreSQL (port 5432)
- Redis (port 6379)
- pgAdmin (http://localhost:5050)

## 3. Start Backend Server

```bash
cd backend
npm run start:dev
```

Backend will run on: http://localhost:3000

## 4. Start Frontend Server

```bash
npm run dev
```

Frontend will run on: http://localhost:3000 (Next.js)

## 5. Access the Application

- **Homepage**: http://localhost:3000
- **Search Page**: http://localhost:3000/search
- **pgAdmin**: http://localhost:5050
  - Email: admin@petchain.com
  - Password: admin

## 6. Test the Search

### Using the UI

1. Go to http://localhost:3000/search
2. Select a search type (All, Pets, Vets, etc.)
3. Type in the search box
4. Try the filters
5. Click "Use My Location" for geolocation

### Using API Directly

```bash
# Search pets
curl "http://localhost:3000/api/v1/search/pets?query=golden"

# Autocomplete
curl "http://localhost:3000/api/v1/search/autocomplete?query=gold&type=pets"

# Popular queries
curl "http://localhost:3000/api/v1/search/popular"

# Analytics
curl "http://localhost:3000/api/v1/search/analytics"
```

## 7. Seed Sample Data (Recommended)

Create a seed script or manually add data:

### Add a Pet

```bash
curl -X POST http://localhost:3000/api/v1/pets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Max",
    "breed": "Golden Retriever",
    "species": "Dog",
    "age": 3,
    "location": "San Francisco, CA",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "status": "active",
    "ownerId": "YOUR_USER_ID"
  }'
```

### Add a Vet

```bash
curl -X POST http://localhost:3000/api/v1/vets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Sarah Johnson",
    "email": "sarah@vetclinic.com",
    "specialty": "General Practice",
    "clinicName": "SF Pet Clinic",
    "location": "San Francisco, CA",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "yearsOfExperience": 10,
    "rating": 4.8
  }'
```

### Add an Emergency Service

```bash
curl -X POST http://localhost:3000/api/v1/emergency-services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "24/7 Pet Emergency",
    "serviceType": "Emergency Clinic",
    "phone": "+1-555-0123",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "location": "San Francisco, CA",
    "address": "123 Main St, SF, CA 94102",
    "is24Hours": true,
    "rating": 4.5
  }'
```

## 8. Common Issues

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Docker Services Not Starting

```bash
# Stop all containers
docker-compose down

# Remove volumes
docker-compose down -v

# Restart
docker-compose up -d
```

### Database Connection Error

Check `.env` file in backend directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=petchain_db
```

### TypeScript Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 9. Development Workflow

### Making Changes

1. Edit files
2. Backend auto-reloads (nodemon)
3. Frontend auto-reloads (Next.js)
4. Test in browser
5. Check API responses

### Adding New Fields

1. Update entity in `backend/src/modules/*/entities/`
2. Update DTO in `backend/src/modules/*/dto/`
3. Add to search query in `search.service.ts`
4. Update frontend filters in `SearchBar.tsx`

### Testing Search

1. Add sample data
2. Search in UI
3. Check console for network requests
4. Verify response format
5. Test filters and pagination

## 10. Environment Variables

### Backend (.env)

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=petchain_db
DB_SYNCHRONIZE=true
DB_LOGGING=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## 11. Useful Commands

```bash
# Backend
npm run start:dev      # Start dev server
npm run build          # Build production
npm run start:prod     # Start production
npm run lint           # Lint code

# Frontend
npm run dev            # Start dev server
npm run build          # Build production
npm run start          # Start production
npm run lint           # Lint code

# Docker
docker-compose up -d           # Start services
docker-compose down            # Stop services
docker-compose logs -f         # View logs
docker-compose ps              # List services
```

## 12. API Testing with Postman

Import these endpoints:

- Base URL: http://localhost:3000/api/v1
- Endpoints: `/search/pets`, `/search/vets`, etc.
- Headers: `Content-Type: application/json`

## 13. Monitoring & Debugging

### Check Backend Logs

```bash
# Terminal running npm run start:dev
# Logs appear automatically
```

### Check Database

```bash
# Access pgAdmin at http://localhost:5050
# Connect to petchain_postgres
# Run SQL queries
```

### Check Redis

```bash
# Access Redis CLI
docker exec -it petchain_redis redis-cli

# List keys
KEYS *

# Get value
GET search:pets:query
```

## 14. Next Steps

1. ✅ Set up environment
2. ✅ Start services
3. ✅ Test basic search
4. ⬜ Seed sample data
5. ⬜ Test all search types
6. ⬜ Test geolocation
7. ⬜ Check analytics
8. ⬜ Review performance

## 15. Support

- **Issues**: Create GitHub issue
- **Questions**: Telegram [@llins_x](https://t.me/llins_x)
- **Documentation**:
  - `SEARCH_IMPLEMENTATION.md` - Detailed guide
  - `IMPLEMENTATION_SUMMARY.md` - Complete summary

## 16. Success Checklist

- [ ] Docker services running
- [ ] Backend server running on port 3000
- [ ] Frontend running (Next.js dev server)
- [ ] Can access http://localhost:3000/search
- [ ] Database tables created
- [ ] Can create pets/vets via API
- [ ] Search returns results
- [ ] Autocomplete works
- [ ] Filters work
- [ ] Geolocation works
- [ ] Analytics endpoint returns data

---

**Time to Complete**: ~10 minutes
**Difficulty**: Easy

Happy Searching! 🔍

# Advanced Search System - Implementation Guide

## Overview

This document describes the comprehensive search system implemented for PetChain, including full-text search, faceted filtering, autocomplete, analytics, and geolocation capabilities.

## Features Implemented

### ✅ 1. Full-Text Search with Relevance Scoring

- PostgreSQL ILIKE-based text search across multiple fields
- Search across Pets, Vets, Medical Records, and Emergency Services
- Global search capability across all entities simultaneously
- Query optimization with proper indexes

### ✅ 2. Faceted Search with Filters

**Pet Filters:**

- Breed
- Age range (min/max)
- Location
- Status (active, missing, deceased)

**Vet Filters:**

- Specialty
- Location
- Rating
- Availability status

**Medical Record Filters:**

- Condition
- Treatment
- Date range
- Status

**Emergency Service Filters:**

- Service type
- 24/7 availability
- Location
- Rating

### ✅ 3. Auto-Complete and Suggestions

- Real-time autocomplete as users type (2+ characters)
- Debounced API calls (300ms) for performance
- Type-specific suggestions based on search domain
- Display of popular searches from analytics

### ✅ 4. Search Analytics and Popular Queries

**Tracked Metrics:**

- Query text
- Search type (pets, vets, etc.)
- Results count
- Response time
- Filter usage
- Success rate
- User information (optional)

**Analytics Dashboard:**

- Total searches
- Success rate
- Average response time
- Searches by type
- Popular queries with counts

### ✅ 5. Geolocation-Based Search

- Browser geolocation integration
- Haversine formula for distance calculation
- Configurable radius (default: 10km for general, 50km for emergency)
- Distance-based sorting for emergency services
- "Use My Location" button with loading state

### ✅ 6. Search Result Caching

- Redis container added to docker-compose
- Cache infrastructure ready for implementation
- Designed for sub-50ms response times with cache hits

### ✅ 7. Search Performance Monitoring

- Automatic tracking of search execution time
- Response time analytics
- Query performance insights
- Historical performance data

## Architecture

### Backend Structure

```
backend/src/modules/
├── pets/
│   ├── entities/pet.entity.ts
│   ├── dto/
│   ├── pets.controller.ts
│   ├── pets.service.ts
│   └── pets.module.ts
├── medical-records/
├── vets/
├── emergency-services/
└── search/
    ├── entities/search-analytics.entity.ts
    ├── dto/search-query.dto.ts
    ├── interfaces/search-result.interface.ts
    ├── search.controller.ts
    ├── search.service.ts
    └── search.module.ts
```

### Frontend Structure

```
src/
├── components/
│   ├── SearchBar.tsx       # Main search input with filters
│   └── SearchResults.tsx   # Results display with pagination
├── pages/
│   └── search.tsx          # Search page with tabs
└── utils/
    └── debounce.ts         # Utility for debouncing
```

## API Endpoints

### Search Endpoints

```
GET /api/v1/search/pets
GET /api/v1/search/vets
GET /api/v1/search/medical-records
GET /api/v1/search/emergency-services
GET /api/v1/search/global
GET /api/v1/search/autocomplete
GET /api/v1/search/popular
GET /api/v1/search/analytics
```

### Query Parameters

```typescript
{
  query?: string;
  type?: string;
  page?: number;
  limit?: number;

  // Filters
  breed?: string;
  minAge?: number;
  maxAge?: number;
  location?: string;
  specialty?: string;
  condition?: string;
  treatment?: string;
  serviceType?: string;
  is24Hours?: boolean;

  // Geolocation
  latitude?: number;
  longitude?: number;
  radius?: number;

  // Sorting
  sortBy?: 'relevance' | 'date' | 'distance' | 'rating' | 'name';
  sortOrder?: 'ASC' | 'DESC';
}
```

## Database Schema

### Entities Created

1. **Pet**: name, breed, species, age, location, coordinates, status
2. **MedicalRecord**: condition, treatment, diagnosis, medications, attachments
3. **Vet**: name, specialty, location, coordinates, rating, experience
4. **EmergencyService**: name, serviceType, location, coordinates, 24/7 status
5. **SearchAnalytics**: query, searchType, resultsCount, responseTime, filters

### Indexes

- Full-text search fields (breed, condition, specialty, etc.)
- Location fields for geolocation queries
- Created/updated timestamps
- Foreign keys for relationships

## Usage Examples

### Backend Usage

```typescript
// Search pets by breed and location
const results = await searchService.searchPets({
  query: "golden retriever",
  location: "San Francisco",
  minAge: 1,
  maxAge: 5,
  page: 1,
  limit: 10,
});

// Geolocation search for emergency services
const nearby = await searchService.searchEmergencyServices({
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 25,
  is24Hours: true,
  sortBy: "distance",
});

// Get autocomplete suggestions
const suggestions = await searchService.autocomplete("golden", "pets");

// Get popular queries
const popular = await searchService.getPopularQueries(10);

// Get analytics
const analytics = await searchService.getSearchAnalytics(7);
```

### Frontend Usage

```tsx
import SearchBar from "@/components/SearchBar";
import SearchResults from "@/components/SearchResults";

function MySearchPage() {
  const handleSearch = async (query, filters) => {
    const response = await fetch(`/api/v1/search/pets?query=${query}&...`);
    const data = await response.json();
    setResults(data);
  };

  return (
    <>
      <SearchBar onSearch={handleSearch} searchType="pets" showFilters={true} />
      <SearchResults
        results={results.results}
        total={results.total}
        page={results.page}
        totalPages={results.totalPages}
        onPageChange={handlePageChange}
        renderItem={renderPetCard}
      />
    </>
  );
}
```

## Performance Optimizations

1. **Database Indexes**: Strategic indexes on searchable fields
2. **Query Optimization**: Efficient WHERE clauses and JOIN operations
3. **Pagination**: Limit result sets with configurable page sizes
4. **Debouncing**: 300ms debounce on autocomplete to reduce API calls
5. **Geolocation Caching**: User location cached in session
6. **Redis Ready**: Infrastructure for caching frequent queries

## Testing the System

### 1. Start the Backend

```bash
cd backend
docker-compose up -d
npm install
npm run start:dev
```

### 2. Start the Frontend

```bash
npm install
npm run dev
```

### 3. Access the Search

- Open http://localhost:3000/search
- Try different search types (Pets, Vets, etc.)
- Test filters and geolocation
- Check analytics at `/api/v1/search/analytics`

## Future Enhancements

1. **Elasticsearch Integration**: For even more powerful full-text search
2. **Machine Learning**: Learn from user behavior to improve relevance
3. **Voice Search**: Add speech-to-text capabilities
4. **Search History**: Per-user search history
5. **Saved Searches**: Allow users to save frequent searches
6. **Advanced Filters**: More granular filtering options
7. **Export Results**: Download search results as CSV/PDF

## Troubleshooting

### Common Issues

**No results returned:**

- Check database has data
- Verify API endpoints are accessible
- Check console for errors

**Geolocation not working:**

- Ensure HTTPS or localhost
- Check browser permissions
- Verify coordinates in filters

**Autocomplete not appearing:**

- Check minimum 2 characters typed
- Verify debounce timing
- Check API response in network tab

## Support

For issues or questions:

- Check the main README.md
- Open a GitHub issue
- Contact [@llins_x](https://t.me/llins_x)

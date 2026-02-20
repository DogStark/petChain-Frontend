# Analytics Dashboard API

## Endpoints

### 1. User Metrics
**GET** `/analytics/users`

Returns user statistics including total, active, and new users.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "totalUsers": 150,
  "activeUsers": 120,
  "newUsers": 25,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.999Z"
}
```

### 2. Pet Registration Trends
**GET** `/analytics/pets/trends`

Returns pet registration trends over time.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "trends": [
    { "date": "2024-01-15", "count": "5" },
    { "date": "2024-01-16", "count": "8" }
  ],
  "totalPets": 450,
  "newPets": 35,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.999Z"
}
```

### 3. Vaccination Compliance
**GET** `/analytics/vaccinations/compliance`

Returns vaccination compliance rates and statistics.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "totalVaccinations": 500,
  "upcomingDue": 45,
  "overdue": 12,
  "administered": 78,
  "complianceRate": 97.6,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.999Z"
}
```

### 4. Appointment Statistics
**GET** `/analytics/appointments/statistics`

Returns appointment statistics grouped by status.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "total": 120,
  "byStatus": {
    "scheduled": 45,
    "completed": 60,
    "cancelled": 10,
    "no_show": 5
  },
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.999Z"
}
```

### 5. Geographic Distribution
**GET** `/analytics/geographic/distribution`

Returns geographic distribution of users.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "totalLocations": 150,
  "distribution": [...],
  "note": "Geographic data requires location field in user entity"
}
```

### 6. Dashboard Overview
**GET** `/analytics/dashboard`

Returns comprehensive analytics combining all metrics.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "users": { ... },
  "pets": { ... },
  "vaccinations": { ... },
  "appointments": { ... },
  "geographic": { ... }
}
```

### 7. Export Reports
**GET** `/analytics/export`

Exports analytics data in JSON or CSV format.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `format` (optional): `json` | `csv` (default: `json`)

**Response:**
- CSV file download or JSON file download

## Authentication

All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <token>
```

## Date Range

If no date range is provided, defaults to the last 30 days.

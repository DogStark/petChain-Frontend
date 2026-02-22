# Allergy & Condition Tracking System

## Overview
This document describes the implementation of the Allergy & Condition Tracking system for PetChain. This feature allows pet owners and veterinarians to track pet allergies, chronic conditions, and related medical information.

## Features Implemented

### 1. Allergy Tracking
- ✅ Add/remove allergies
- ✅ Severity levels (mild, moderate, severe, life-threatening)
- ✅ Reaction notes
- ✅ Alert veterinarians about allergies
- ✅ Allergy testing results
- ✅ Additional notes field

### 2. Chronic Condition Tracking
- ✅ Add/remove conditions
- ✅ Condition status tracking (active, managed, resolved, monitoring)
- ✅ Severity levels (mild, moderate, severe, critical)
- ✅ Treatment and medication tracking
- ✅ Veterinarian and clinic information
- ✅ Checkup date tracking
- ✅ Chronic condition flagging
- ✅ Ongoing care requirements

## Database Schema

### Allergies Table
```sql
CREATE TABLE allergies (
    id UUID PRIMARY KEY,
    petId UUID NOT NULL REFERENCES pets(id),
    allergen VARCHAR(255) NOT NULL,
    severity ENUM('mild', 'moderate', 'severe', 'life_threatening') NOT NULL,
    reactionNotes TEXT,
    discoveredDate DATE NOT NULL,
    notes TEXT,
    testingResults TEXT,
    testingDate DATE,
    testedBy VARCHAR(255),
    alertVeterinarian BOOLEAN DEFAULT false,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Conditions Table
```sql
CREATE TABLE conditions (
    id UUID PRIMARY KEY,
    petId UUID NOT NULL REFERENCES pets(id),
    conditionName VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('active', 'managed', 'resolved', 'monitoring') DEFAULT 'active',
    severity ENUM('mild', 'moderate', 'severe', 'critical') DEFAULT 'mild',
    diagnosedDate DATE NOT NULL,
    treatment TEXT,
    medications TEXT,
    notes TEXT,
    veterinarianName VARCHAR(255),
    clinicName VARCHAR(255),
    lastCheckupDate DATE,
    nextCheckupDate DATE,
    requiresOngoingCare BOOLEAN DEFAULT false,
    isChronicCondition BOOLEAN DEFAULT false,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Allergies API

#### Create Allergy
```http
POST /allergies
Content-Type: application/json

{
  "petId": "uuid",
  "allergen": "Peanuts",
  "severity": "severe",
  "reactionNotes": "Swelling and difficulty breathing",
  "discoveredDate": "2024-01-15",
  "notes": "Keep away from all nut products",
  "testingResults": "Positive IgE test",
  "testingDate": "2024-01-10",
  "testedBy": "Dr. Smith",
  "alertVeterinarian": true
}
```

#### Get All Allergies
```http
GET /allergies?petId=uuid
```

#### Get Allergies by Pet
```http
GET /allergies/pet/:petId
```

#### Get Allergies with Vet Alerts
```http
GET /allergies/pet/:petId/vet-alerts
```

#### Get Severe Allergies
```http
GET /allergies/pet/:petId/severe
```

#### Get Allergy Summary
```http
GET /allergies/pet/:petId/summary

Response:
{
  "total": 5,
  "severe": 2,
  "withVetAlert": 3,
  "tested": 4
}
```

#### Get Single Allergy
```http
GET /allergies/:id
```

#### Update Allergy
```http
PATCH /allergies/:id
Content-Type: application/json

{
  "severity": "moderate",
  "notes": "Reaction has decreased over time"
}
```

#### Delete Allergy
```http
DELETE /allergies/:id
```

### Conditions API

#### Create Condition
```http
POST /conditions
Content-Type: application/json

{
  "petId": "uuid",
  "conditionName": "Diabetes",
  "description": "Type 1 Diabetes requiring insulin",
  "status": "active",
  "severity": "severe",
  "diagnosedDate": "2023-06-15",
  "treatment": "Daily insulin injections",
  "medications": "Insulin 10 units twice daily",
  "notes": "Monitor blood glucose levels",
  "veterinarianName": "Dr. Johnson",
  "clinicName": "Pet Care Clinic",
  "lastCheckupDate": "2024-01-20",
  "nextCheckupDate": "2024-04-20",
  "requiresOngoingCare": true,
  "isChronicCondition": true
}
```

#### Get All Conditions
```http
GET /conditions?petId=uuid
```

#### Get Conditions by Pet
```http
GET /conditions/pet/:petId
```

#### Get Chronic Conditions
```http
GET /conditions/pet/:petId/chronic
```

#### Get Active Conditions
```http
GET /conditions/pet/:petId/active
```

#### Get Condition Summary
```http
GET /conditions/pet/:petId/summary

Response:
{
  "total": 3,
  "active": 2,
  "chronic": 1,
  "requiresOngoingCare": 2
}
```

#### Get Single Condition
```http
GET /conditions/:id
```

#### Update Condition
```http
PATCH /conditions/:id
Content-Type: application/json

{
  "status": "managed",
  "notes": "Condition is now under control"
}
```

#### Delete Condition
```http
DELETE /conditions/:id
```

## Entity Relationships

```
Pet (1) -----> (Many) Allergies
Pet (1) -----> (Many) Conditions
```

## Enums

### AllergySeverity
- `MILD` - Minor reactions
- `MODERATE` - Noticeable reactions requiring attention
- `SEVERE` - Serious reactions requiring immediate care
- `LIFE_THREATENING` - Critical reactions requiring emergency care

### ConditionStatus
- `ACTIVE` - Condition is currently active
- `MANAGED` - Condition is being managed with treatment
- `RESOLVED` - Condition has been resolved
- `MONITORING` - Condition is being monitored

### ConditionSeverity
- `MILD` - Minor condition
- `MODERATE` - Moderate condition requiring regular care
- `SEVERE` - Serious condition requiring intensive care
- `CRITICAL` - Critical condition requiring immediate attention

## Usage Examples

### TypeScript/JavaScript Client

```typescript
// Create an allergy
const allergy = await fetch('/allergies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    petId: 'pet-uuid',
    allergen: 'Chicken',
    severity: 'moderate',
    reactionNotes: 'Skin rash and itching',
    discoveredDate: '2024-02-01',
    alertVeterinarian: true
  })
});

// Get all allergies for a pet
const allergies = await fetch('/allergies/pet/pet-uuid');

// Get allergy summary
const summary = await fetch('/allergies/pet/pet-uuid/summary');

// Create a condition
const condition = await fetch('/conditions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    petId: 'pet-uuid',
    conditionName: 'Arthritis',
    severity: 'moderate',
    diagnosedDate: '2023-12-01',
    isChronicCondition: true,
    requiresOngoingCare: true
  })
});

// Get chronic conditions
const chronicConditions = await fetch('/conditions/pet/pet-uuid/chronic');
```

## Testing

To test the implementation:

1. **Start the backend server:**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

2. **Test with curl:**
   ```bash
   # Create an allergy
   curl -X POST http://localhost:3000/allergies \
     -H "Content-Type: application/json" \
     -d '{
       "petId": "your-pet-uuid",
       "allergen": "Pollen",
       "severity": "mild",
       "discoveredDate": "2024-02-21"
     }'

   # Get allergies
   curl http://localhost:3000/allergies/pet/your-pet-uuid

   # Create a condition
   curl -X POST http://localhost:3000/conditions \
     -H "Content-Type: application/json" \
     -d '{
       "petId": "your-pet-uuid",
       "conditionName": "Hip Dysplasia",
       "severity": "moderate",
       "diagnosedDate": "2024-01-15",
       "isChronicCondition": true
     }'

   # Get conditions
   curl http://localhost:3000/conditions/pet/your-pet-uuid
   ```

## Migration Notes

When deploying this feature, ensure:

1. Database migrations are run to create the new tables
2. TypeORM will auto-generate the tables based on the entities
3. No existing data will be affected
4. The Pet entity relationship is properly configured

## Security Considerations

- All endpoints should be protected with authentication
- Users should only access allergies/conditions for their own pets
- Veterinarians should have read access to all pet records
- Consider implementing role-based access control (RBAC)

## Future Enhancements

- [ ] Email notifications to vets when alertVeterinarian is true
- [ ] Automatic reminders for upcoming checkups
- [ ] Integration with prescription system for medication tracking
- [ ] Export allergy/condition reports as PDF
- [ ] Mobile push notifications for critical allergies
- [ ] Integration with emergency services to share critical allergy info
- [ ] Allergy cross-reference with food/medication databases
- [ ] Condition progression tracking with timeline view

## Support

For issues or questions about this implementation, please refer to:
- Main README: `/backend/README.md`
- API Documentation: `/backend/API_DOCUMENTATION.md`
- Database Migration Guide: `/DATABASE_MIGRATION.sql`

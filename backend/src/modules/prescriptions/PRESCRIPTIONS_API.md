# Pet Prescriptions Management API Documentation

## Overview

The Pet Prescriptions Management System provides comprehensive medication management for pets, including prescription creation, dosage calculations, refill tracking, and drug interaction warnings.

## Features

- **Create & Manage Prescriptions**: Create, update, and manage pet medications
- **Medication Database**: Comprehensive medication library with dosing information
- **Dosage Calculations**: Automatic dosage calculations based on pet weight and age
- **Refill Tracking**: Track prescription refills and manage refill reminders
- **Prescription History**: Complete history of all prescriptions for each pet
- **Drug Interaction Warnings**: Check for dangerous medication interactions
- **Refill Reminders**: Get alerts for upcoming refills
- **Status Management**: Track prescription lifecycle (pending, active, expired, discontinued)

## Database Schema

### Prescriptions Table
```sql
prescriptions: 
  - id (UUID, Primary Key)
  - pet_id (UUID, Foreign Key)
  - vet_id (UUID, Foreign Key)
  - medication (VARCHAR)
  - dosage (VARCHAR)
  - frequency (VARCHAR)
  - duration (INT, optional - in days)
  - start_date (DATE)
  - end_date (DATE, optional - calculated from duration if not provided)
  - instructions (TEXT, optional)
  - pharmacy_info (VARCHAR, optional)
  - refills_remaining (INT, default: 0)
  - refills_used (INT, default: 0)
  - notes (TEXT, optional)
  - status (ENUM: active, pending, expired, completed, discontinued)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Medications Table
```sql
medications:
  - id (UUID, Primary Key)
  - name (VARCHAR, unique)
  - generic_name (VARCHAR, unique)
  - brand_names (TEXT, optional)
  - type (ENUM: antibiotic, pain_relief, anti_inflammatory, etc.)
  - active_ingredient (TEXT)
  - description (TEXT)
  - side_effects (TEXT)
  - contraindications (TEXT)
  - warnings (TEXT)
  - precautions (TEXT)
  - dosage_units (VARCHAR)
  - typical_dosage_range (VARCHAR)
  - max_daily_dose (VARCHAR)
  - pet_specific_info (TEXT)
  - food_interactions (VARCHAR)
  - is_active (BOOLEAN)
  - manufacturer (VARCHAR)
  - storage_instructions (TEXT)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Drug Interactions Table
```sql
drug_interactions:
  - id (UUID, Primary Key)
  - medication_id_1 (UUID, Foreign Key)
  - medication_id_2 (UUID, Foreign Key)
  - severity (ENUM: mild, moderate, severe, contraindicated)
  - description (TEXT)
  - mechanism (TEXT, optional)
  - management_strategies (TEXT, optional)
  - symptoms (TEXT, optional)
  - is_active (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Prescription Refills Table
```sql
prescription_refills:
  - id (UUID, Primary Key)
  - prescription_id (UUID, Foreign Key)
  - refill_date (DATE)
  - expiration_date (DATE, optional)
  - quantity (INT)
  - pharmacy_name (VARCHAR, optional)
  - notes (TEXT, optional)
  - created_at (TIMESTAMP)
```

## API Endpoints

### Prescription Management

#### Create Prescription
```
POST /prescriptions
Content-Type: application/json

{
  "petId": "uuid",
  "vetId": "uuid",
  "medication": "Amoxicillin",
  "dosage": "250mg",
  "frequency": "Every 12 hours (2x daily)",
  "duration": 14,
  "startDate": "2026-02-20",
  "endDate": "2026-03-06",
  "instructions": "Take with food. Complete full course.",
  "refillsRemaining": 3,
  "notes": "For bacterial infection"
}
```

#### Get All Prescriptions
```
GET /prescriptions
GET /prescriptions?petId=uuid
```

#### Get Prescription by ID
```
GET /prescriptions/:id
```

#### Update Prescription
```
PATCH /prescriptions/:id
Content-Type: application/json

{
  "refillsRemaining": 2,
  "notes": "Updated notes"
}
```

#### Delete Prescription
```
DELETE /prescriptions/:id
```

#### Discontinue Prescription
```
PATCH /prescriptions/:id/discontinue
Content-Type: application/json

{
  "reason": "Owner preference"
}
```

### Prescription Queries

#### Get Active Prescriptions for Pet
```
GET /prescriptions/pet/:petId/active
```

Response:
```json
[
  {
    "id": "uuid",
    "medication": "Carprofen",
    "dosage": "100mg",
    "frequency": "Every 12 hours (2x daily)",
    "startDate": "2026-02-01",
    "endDate": "2026-02-15",
    "status": "active",
    "refillsRemaining": 2
  }
]
```

#### Get Expired Prescriptions for Pet
```
GET /prescriptions/pet/:petId/expired
```

#### Get Prescription History for Pet
```
GET /prescriptions/pet/:petId/history
```

Response:
```json
[
  {
    "id": "uuid",
    "medication": "Amoxicillin",
    "dosage": "250mg",
    "frequency": "Every 8 hours (3x daily)",
    "startDate": "2026-01-15",
    "endDate": "2026-01-29",
    "status": "completed",
    "refillsRemaining": 0,
    "refillsUsed": 3,
    "createdAt": "2026-01-15T10:00:00Z"
  }
]
```

#### Get Prescriptions by Status
```
GET /prescriptions/pet/:petId/status/:status

Status values: active, pending, expired, completed, discontinued
```

#### Get Expiring Prescriptions
```
GET /prescriptions/pet/:petId/expiring-soon?days=30
```

### Refill Management

#### Get Refill Reminders
```
GET /prescriptions/reminders?days=7

Response:
[
  {
    "prescriptionId": "uuid",
    "medication": "Carprofen",
    "frequency": "Every 12 hours (2x daily)",
    "refillsRemaining": 2,
    "daysUntilRefill": 3,
    "estimatedRefillDate": "2026-02-23",
    "petName": "Max",
    "petId": "uuid"
  }
]
```

#### Record a Refill
```
POST /prescriptions/:id/record-refill
Content-Type: application/json

{
  "quantity": 30,
  "pharmacyName": "PetMeds Pharmacy"
}

Response:
{
  "id": "uuid",
  "prescriptionId": "uuid",
  "refillDate": "2026-02-20",
  "expirationDate": "2026-03-22",
  "quantity": 30,
  "pharmacyName": "PetMeds Pharmacy",
  "createdAt": "2026-02-20T10:00:00Z"
}
```

#### Check if Refill Needed
```
GET /prescriptions/:id/check-refill-needed

Response:
{
  "needsRefill": true
}
```

#### Get Refill History for Prescription
```
GET /prescriptions/:id/refill-history
```

#### Get Pet Refill History
```
GET /prescriptions/pet/:petId/refill-history
```

### Dosage Calculations

#### Calculate Dosage
```
POST /prescriptions/calculate-dosage/validate
Content-Type: application/json

{
  "medicationName": "Amoxicillin",
  "petWeight": 25,
  "weightUnit": "kg",
  "age": 3,
  "dosagePerKg": 25,
  "concentration": 250
}

Response:
{
  "dosage": 625,
  "unit": "mg",
  "frequency": "Every 8 hours (3x daily) or every 12 hours (2x daily)",
  "volume": 2.5,
  "volumeUnit": "ml",
  "warnings": []
}
```

#### Validate Dosage
```
POST /prescriptions/calculate-dosage/validate
Content-Type: application/json

{
  "medicationName": "Carprofen",
  "dosage": 100,
  "petWeight": 25
}

Response:
{
  "isValid": true,
  "warnings": []
}
```

#### Get Medication Frequencies
```
GET /prescriptions/calculate-dosage/frequencies

Response:
{
  "Once daily": ["omeprazole", "meloxicam"],
  "Twice daily": ["carprofen", "doxycycline"],
  "Three times daily": ["amoxicillin", "tramadol"],
  "As needed": ["diphenhydramine", "tramadol"],
  "Every 72 hours": ["azithromycin"]
}
```

### Drug Interactions

#### Check Interactions Between Medications
```
POST /prescriptions/check-interactions
Content-Type: application/json

{
  "medicationNames": ["Amoxicillin", "Carprofen"]
}

Response:
{
  "interactions": [
    {
      "medication1": "Amoxicillin",
      "medication2": "Carprofen",
      "severity": "moderate",
      "description": "NSAIDs may increase amoxicillin levels",
      "mechanism": "Reduced renal clearance",
      "managementStrategies": "Monitor for side effects",
      "symptoms": "GI upset, diarrhea"
    }
  ],
  "severeWarnings": [],
  "allClear": false
}
```

#### Get Interactions for a Medication
```
GET /prescriptions/:medicationId/interactions
```

### Medication Management

#### Create Medication
```
POST /medications
Content-Type: application/json

{
  "name": "Amoxicillin",
  "genericName": "amoxicillin",
  "type": "antibiotic",
  "activeIngredient": "amoxicillin trihydrate",
  "sideEffects": "Diarrhea, vomiting, allergic reactions",
  "contraindications": "Penicillin allergy",
  "typicalDosageRange": "20-40 mg/kg",
  "dosageUnits": "mg",
  "foodInteractions": "Can be taken with or without food"
}
```

#### Get All Medications
```
GET /medications
GET /medications?isActive=true
```

#### Get Medication by Type
```
GET /medications/type/:type

Types: antibiotic, pain_relief, anti_inflammatory, antifungal, antihistamine, etc.
```

#### Search Medications
```
GET /medications/search?query=amox
```

## Common Dosages Reference

### Antibiotics
- **Amoxicillin**: 20-40 mg/kg every 8-12 hours
- **Doxycycline**: 5-10 mg/kg every 12 hours
- **Enrofloxacin**: 5-20 mg/kg every 12 hours
- **Cephalexin**: 25-40 mg/kg every 8 hours

### Pain Relief
- **Carprofen (Rimadyl)**: 4 mg/kg every 12 hours
- **Meloxicam (Metacam)**: 0.1-0.2 mg/kg once daily
- **Tramadol**: 5-10 mg/kg every 8 hours as needed
- **Gabapentin**: 10-30 mg/kg every 8 hours

### Anti-Inflammatory
- **Prednisone**: 0.5-2 mg/kg once to twice daily
- **Dexamethasone**: 0.1-0.3 mg/kg every 12 hours

### Antihistamine
- **Diphenhydramine**: 2-4 mg/kg every 6-8 hours as needed
- **Cetirizine**: 0.5-1 mg/kg once daily

## Status Transitions

```
PENDING → ACTIVE (when start date is reached)
        → EXPIRED (if end date passes)

ACTIVE  → EXPIRED (when end date is reached)
       → COMPLETED (when all refills used)
       → DISCONTINUED (by veterinarian order)

EXPIRED → (terminal state)
COMPLETED → (terminal state)
DISCONTINUED → (terminal state)
```

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid pet weight",
  "error": "Bad Request"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Prescription with ID xyz not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "No refills remaining for this prescription",
  "error": "Conflict"
}
```

## Best Practices

1. **Always provide vet_id**: Prescriptions should be linked to a veterinarian
2. **Set refills_remaining**: Specify how many refills are authorized
3. **Use duration or end_date**: Either provide duration (auto-calculates end_date) or explicitly set end_date
4. **Check interactions**: Before prescribing, check for drug interactions
5. **Validate dosages**: Use dosage calculation service to verify correct dosing
6. **Track refills**: Record each refill to maintain accurate refill count
7. **Monitor expiry**: Check expiring prescriptions regularly

## Examples

### Example 1: Create an Antibiotic Prescription
```
POST /prescriptions
{
  "petId": "abc123",
  "vetId": "vet456",
  "medication": "Amoxicillin",
  "dosage": "250mg",
  "frequency": "Every 8 hours (3x daily)",
  "duration": 14,
  "startDate": "2026-02-20",
  "instructions": "Take with food. Complete full 14-day course.",
  "refillsRemaining": 0,
  "notes": "For ear infection - 25kg dog"
}
```

### Example 2: Check Drug Interactions
```
POST /prescriptions/check-interactions
{
  "medicationNames": ["Amoxicillin", "Carprofen", "Gabapentin"]
}
```

### Example 3: Calculate Dosage for New Prescription
```
POST /prescriptions/calculate-dosage/validate
{
  "medicationName": "Carprofen",
  "petWeight": 25,
  "weightUnit": "kg",
  "age": 5,
  "dosagePerKg": 4
}
```

### Example 4: Set Up Refill Reminder
```
GET /prescriptions/reminders?days=7
```

### Example 5: Record a Refill
```
POST /prescriptions/abc123/record-refill
{
  "quantity": 30,
  "pharmacyName": "PetCare Pharmacy"
}
```

## Notes

- Dosage calculations are provided as guidance; always verify with veterinarian
- Drug interaction database is continuously updated with new information
- Prescription status is automatically managed based on dates
- Refill reminders are based on typical supply duration
- All timestamps are in UTC

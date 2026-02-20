# Pet Prescriptions Management Module

## Overview

The Prescriptions Management module provides a comprehensive system for managing pet medications, including prescription creation, dosage calculations, refill tracking, and drug interaction warnings.

## Features

✅ **Prescription Management**
- Create, read, update, and delete prescriptions
- Track prescription status (pending, active, expired, completed, discontinued)
- Auto-calculate end dates based on duration
- Store detailed medication instructions

✅ **Medication Database**
- Comprehensive medication library with dosing information
- Medication types and classifications
- Side effects, contraindications, and warnings
- Active ingredient and brand name tracking

✅ **Dosage Calculations**
- Weight-based dosage calculations
- Age-adjusted dosages
- Medication frequency recommendations
- Liquid concentration to volume conversion
- Dosage validation against safe ranges

✅ **Refill Management**
- Track refills remaining and used
- Record refill history with pharmacy information
- Refill reminders with configurable time windows
- Refill expiration date tracking
- Automatic status updates based on refills

✅ **Drug Interaction Warnings**
- Check interactions between multiple medications
- Severity levels (mild, moderate, severe, contraindicated)
- Mechanism and management strategies
- Side effect and symptom tracking

✅ **Prescription History**
- Complete history of all prescriptions per pet
- Filter by status and date ranges
- Refill history tracking
- Pet-level refill overview

## Module Structure

```
prescriptions/
├── entities/
│   ├── prescription.entity.ts          # Main prescription entity
│   ├── prescription-refill.entity.ts   # Refill history tracking
│   ├── medication.entity.ts            # Medication database
│   └── drug-interaction.entity.ts      # Drug interaction warnings
├── services/
│   ├── prescriptions.service.ts        # Core prescription logic
│   ├── dosage-calculation.service.ts   # Dosage calculations
│   ├── drug-interaction.service.ts     # Interaction checking
│   └── medication.service.ts           # Medication CRUD
├── dto/
│   ├── create-prescription.dto.ts
│   ├── update-prescription.dto.ts
│   ├── create-medication.dto.ts
│   ├── update-medication.dto.ts
│   ├── create-drug-interaction.dto.ts
│   ├── update-drug-interaction.dto.ts
│   ├── create-prescription-refill.dto.ts
├── prescriptions.controller.ts         # Prescription endpoints
├── medications.controller.ts           # Medication endpoints
├── prescriptions.module.ts             # Module configuration
└── PRESCRIPTIONS_API.md               # API documentation
```

## Database Schema

### Prescriptions Table
- **id**: UUID (Primary Key)
- **pet_id**: UUID (Foreign Key to Pets)
- **vet_id**: UUID (Foreign Key to Vets)
- **medication**: Medication name
- **dosage**: Dosage amount (e.g., "250mg")
- **frequency**: How often to give (e.g., "Every 12 hours")
- **duration**: Duration in days (auto-calculates end_date)
- **start_date**: Date prescription begins
- **end_date**: Date prescription ends
- **instructions**: Detailed medication instructions
- **pharmacy_info**: Pharmacy contact/details
- **refills_remaining**: Number of refills left
- **refills_used**: Number of refills already used
- **notes**: Additional notes
- **status**: Prescription status enum
- **created_at**: Timestamp
- **updated_at**: Timestamp

### Medications Table
- **id**: UUID (Primary Key)
- **name**: Medication name (unique)
- **generic_name**: Generic name (unique)
- **type**: Medication classification
- **active_ingredient**: Active pharmaceutical ingredient
- **side_effects**: Known side effects
- **contraindications**: Conditions to avoid with
- **warnings**: Important warnings
- **typical_dosage_range**: Standard dosing guidance
- **is_active**: Active status

### Drug Interactions Table
- **id**: UUID (Primary Key)
- **medication_id_1**: First medication
- **medication_id_2**: Second medication
- **severity**: Interaction severity level
- **description**: Interaction details
- **mechanism**: How the interaction occurs
- **management_strategies**: How to manage
- **symptoms**: Symptoms to watch for

### Prescription Refills Table
- **id**: UUID (Primary Key)
- **prescription_id**: Linked prescription
- **refill_date**: When refilled
- **expiration_date**: When it expires
- **quantity**: Amount dispensed
- **pharmacy_name**: Which pharmacy
- **notes**: Refill notes

## API Endpoints

### Prescriptions

```
POST   /prescriptions                          # Create prescription
GET    /prescriptions                          # List all
GET    /prescriptions/:id                      # Get one
PATCH  /prescriptions/:id                      # Update
DELETE /prescriptions/:id                      # Delete

GET    /prescriptions/pet/:petId/active        # Active prescriptions
GET    /prescriptions/pet/:petId/expired       # Expired prescriptions
GET    /prescriptions/pet/:petId/history       # Full history
GET    /prescriptions/pet/:petId/expiring-soon # Expiring soon
GET    /prescriptions/pet/:petId/status/:status # By status

PATCH  /prescriptions/:id/discontinue          # Discontinue prescription
```

### Refills

```
GET    /prescriptions/reminders?days=7                     # Refill reminders
POST   /prescriptions/:id/record-refill                    # Record a refill
GET    /prescriptions/:id/check-refill-needed              # Check if refill needed
GET    /prescriptions/:id/refill-history                   # Refill history
GET    /prescriptions/pet/:petId/refill-history            # Pet's all refills
```

### Dosage Calculations

```
POST   /prescriptions/calculate-dosage/validate   # Calculate dosage
POST   /prescriptions/calculate-dosage/validate   # Validate dosage
GET    /prescriptions/calculate-dosage/frequencies # Get frequencies
```

### Drug Interactions

```
POST   /prescriptions/check-interactions          # Check interactions
GET    /prescriptions/:id/interactions            # Get interactions
```

### Medications

```
POST   /medications                               # Create medication
GET    /medications                               # List all
GET    /medications/:id                           # Get one
PATCH  /medications/:id                           # Update
DELETE /medications/:id                           # Delete

GET    /medications/search?query=amox             # Search medications
GET    /medications/type/:type                    # By type
GET    /medications/types                         # All types
GET    /medications/count                         # Count

PATCH  /medications/:id/activate                  # Activate
PATCH  /medications/:id/deactivate                # Deactivate
```

## Usage Examples

### Create a Prescription

```typescript
// In your component or service
const prescription = await axios.post('/prescriptions', {
  petId: 'pet-123',
  vetId: 'vet-456',
  medication: 'Amoxicillin',
  dosage: '250mg',
  frequency: 'Every 8 hours (3x daily)',
  duration: 14,
  startDate: '2026-02-20',
  instructions: 'Take with food. Complete full course.',
  refillsRemaining: 0
});
```

### Calculate Dosage

```typescript
const dosage = await axios.post('/prescriptions/calculate-dosage/validate', {
  medicationName: 'Carprofen',
  petWeight: 25,
  weightUnit: 'kg',
  age: 5
});

// Returns:
// {
//   dosage: 100,
//   unit: 'mg',
//   frequency: 'Every 12 hours (2x daily)',
//   warnings: []
// }
```

### Check Drug Interactions

```typescript
const interactions = await axios.post('/prescriptions/check-interactions', {
  medicationNames: ['Amoxicillin', 'Carprofen']
});

// Returns:
// {
//   interactions: [...],
//   severeWarnings: [...],
//   allClear: false
// }
```

### Get Refill Reminders

```typescript
const reminders = await axios.get('/prescriptions/reminders?days=7');

// Returns array of reminders with:
// - prescriptionId
// - medication name
// - days until refill needed
// - estimated refill date
// - pet name
```

### Record a Refill

```typescript
const refill = await axios.post('/prescriptions/abc123/record-refill', {
  quantity: 30,
  pharmacyName: 'PetCare Pharmacy'
});
```

## Status Lifecycle

```
┌─────────────┐
│  PENDING    │ (Created, before start date)
└──────┬──────┘
       │
       ↓ (Start date reached)
┌─────────────┐
│   ACTIVE    │ (In effect)
└──────┬──────┘
       ├─→ (End date reached) → EXPIRED
       ├─→ (All refills used) → COMPLETED
       └─→ (Vet order) → DISCONTINUED
```

## Medication Types

- **antibiotic**: Antibacterial medications
- **pain_relief**: Pain management medications
- **anti_inflammatory**: Inflammation reduction
- **antifungal**: Anti-fungal medications
- **antihistamine**: Allergy medications
- **antidiarrheal**: Anti-diarrhea medications
- **antiemetic**: Anti-nausea medications
- **cardiac**: Heart medications
- **dermatological**: Skin medications
- **endocrine**: Hormone-related medications
- **gastrointestinal**: GI medications
- **respiratory**: Respiratory medications
- **neurological**: Neurological medications
- **ophthalmic**: Eye medications
- **topical**: Topical medications
- **other**: Other medications

## Interaction Severity Levels

- **mild**: Minor interaction, monitor
- **moderate**: Moderate interaction, consider management strategies
- **severe**: Serious interaction, significant precautions needed
- **contraindicated**: Should not be used together

## Common Medications Database

The module includes a pre-populated database of common pet medications including:
- Amoxicillin
- Carprofen (Rimadyl)
- Meloxicam (Metacam)
- Tramadol
- Gabapentin
- Prednisone
- Doxycycline
- Fluconazole
- Diphenhydramine
- Omeprazole

## Best Practices

1. **Always Verify with Veterinarian**: Dosage calculations are for guidance only
2. **Set Correct Refills**: Specify authorized refill count
3. **Use Duration**: Let system auto-calculate end dates when possible
4. **Check Interactions**: Verify before prescribing multiple medications
5. **Track Refills**: Record each refill to maintain accuracy
6. **Monitor Status**: Check for expiring prescriptions regularly
7. **Update Instructions**: Provide clear medication instructions

## Error Handling

The module includes comprehensive error handling:
- 400 Bad Request: Invalid input
- 404 Not Found: Prescription/medication not found
- 409 Conflict: Business logic violation (e.g., no refills remaining)

## Performance Considerations

- Indexes on frequently queried fields (pet_id, vet_id, status)
- Eager loading of refills with prescriptions
- Efficient drug interaction checking
- Pagination support for large result sets

## Future Enhancements

- [ ] Medication reminder notifications
- [ ] Integration with pharmacy systems
- [ ] Medication cost tracking
- [ ] Prescription renewal workflows
- [ ] Veterinary approval workflows
- [ ] Mobile app integration
- [ ] Analytics dashboard
- [ ] Adverse event reporting

## Migration

Run the database migration to create all required tables:

```bash
psql -U username -d database_name -f DATABASE_MIGRATION_PRESCRIPTIONS.sql
```

## Testing

```bash
# Run unit tests
npm test -- src/modules/prescriptions

# Run integration tests
npm test -- e2e/prescriptions

# Run with coverage
npm test -- --coverage src/modules/prescriptions
```

## Support

For issues, questions, or feature requests related to prescriptions management, please refer to the PRESCRIPTIONS_API.md file for detailed endpoint documentation.

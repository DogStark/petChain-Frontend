import { Injectable } from '@nestjs/common';

export interface DosageCalculationRequest {
  medicationName: string;
  petWeight: number; // in kg
  weightUnit?: 'kg' | 'lbs';
  age?: number; // in years
  dosagePerKg?: number; // dosage per kilogram
  concentration?: number; // medication concentration (mg/ml)
}

export interface DosageResult {
  dosage: number;
  unit: string;
  frequency: string;
  volume?: number;
  volumeUnit?: string;
  warnings: string[];
}

@Injectable()
export class DosageCalculationService {
  /**
   * Calculate dosage based on pet weight and medication
   */
  calculateDosage(request: DosageCalculationRequest): DosageResult {
    const petWeightKg = this.convertToKg(request.petWeight, request.weightUnit);
    const warnings: string[] = [];

    // Default dosages for common medications (mg/kg)
    const medicationDosages: { [key: string]: number } = {
      // Antibiotics
      amoxicillin: 25, // 20-40 mg/kg
      azithromycin: 10, // 10 mg/kg
      doxycycline: 5, // 5-10 mg/kg
      enrofloxacin: 5, // 5-20 mg/kg
      cephalexin: 25, // 25-40 mg/kg

      // Pain Relief
      carprofen: 4, // 4 mg/kg
      meloxicam: 0.2, // 0.1-0.2 mg/kg
      tramadol: 5, // 5-10 mg/kg
      gabapentin: 10, // 10-30 mg/kg

      // Anti-inflammatory
      prednisone: 1, // 0.5-2 mg/kg
      dexamethasone: 0.1, // 0.1-0.3 mg/kg

      // Antifungal
      fluconazole: 5, // 5-10 mg/kg
      terbinafine: 0.6, // 0.6-1.1 mg/kg

      // Antihistamine
      diphenhydramine: 2, // 2-4 mg/kg
      cetirizine: 0.5, // 0.5-1 mg/kg

      // Gastrointestinal
      omeprazole: 1, // 0.5-1 mg/kg
      metronidazole: 12, // 10-25 mg/kg
    };

    const medName = request.medicationName.toLowerCase();
    const dosagePerKg =
      request.dosagePerKg || medicationDosages[medName] || 0;

    if (dosagePerKg === 0) {
      warnings.push(`No standard dosage found for ${request.medicationName}`);
      warnings.push('Please consult with veterinarian for proper dosage');
    }

    const totalDosage = Number((petWeightKg * dosagePerKg).toFixed(2));

    // Age-based adjustments
    if (request.age && request.age < 0.5) {
      warnings.push('This is a very young pet - dosage should be verified by vet');
    } else if (request.age && request.age > 7) {
      warnings.push(
        'Senior pet - liver/kidney function should be considered',
      );
    }

    // Calculate volume if concentration is provided
    let volume: number | undefined;
    let volumeUnit: string | undefined;

    if (request.concentration) {
      volume = Number((totalDosage / request.concentration).toFixed(2));
      volumeUnit = 'ml';
    }

    return {
      dosage: totalDosage,
      unit: 'mg',
      frequency: this.getFrequencyForMedication(medName),
      volume,
      volumeUnit,
      warnings,
    };
  }

  /**
   * Get typical frequency for a medication
   */
  private getFrequencyForMedication(medicationName: string): string {
    const frequencies: { [key: string]: string } = {
      // Twice daily
      amoxicillin: 'Every 8 hours (3x daily) or every 12 hours (2x daily)',
      carprofen: 'Every 12 hours (2x daily)',
      meloxicam: 'Once daily',
      tramadol: 'Every 8 hours (3x daily)',
      gabapentin: 'Every 8 hours (3x daily)',
      azithromycin: 'Once daily for 3 days',
      doxycycline: 'Every 12 hours (2x daily)',
      enrofloxacin: 'Every 12 hours (2x daily)',
      prednisone: 'Once daily or divided doses',
      fluconazole: 'Once or twice daily',
      diphenhydramine: 'Every 6-8 hours as needed',
      omeprazole: 'Once daily',
      metronidazole: 'Every 12 hours (2x daily)',
    };

    return frequencies[medicationName] || 'As prescribed by veterinarian';
  }

  /**
   * Convert weight to kilograms
   */
  private convertToKg(weight: number, unit?: string): number {
    const weightUnit = unit || 'kg';
    if (weightUnit === 'lbs') {
      return Number((weight / 2.205).toFixed(2));
    }
    return weight;
  }

  /**
   * Validate dosage against safe ranges
   */
  validateDosage(
    medicationName: string,
    dosage: number,
    petWeight: number,
  ): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Safe ranges for common medications (mg/kg)
    const safeRanges: {
      [key: string]: { min: number; max: number };
    } = {
      amoxicillin: { min: 20, max: 40 },
      carprofen: { min: 2, max: 4 },
      meloxicam: { min: 0.1, max: 0.2 },
      tramadol: { min: 5, max: 10 },
      gabapentin: { min: 10, max: 30 },
      prednisone: { min: 0.5, max: 2 },
      fluconazole: { min: 5, max: 10 },
      diphenhydramine: { min: 2, max: 4 },
    };

    const medName = medicationName.toLowerCase();
    const range = safeRanges[medName];

    if (range) {
      const dosagePerKg = dosage / petWeight;
      if (dosagePerKg < range.min) {
        warnings.push(
          `Dosage is below recommended range (${range.min}-${range.max} mg/kg)`,
        );
      } else if (dosagePerKg > range.max) {
        warnings.push(
          `Dosage exceeds recommended range (${range.min}-${range.max} mg/kg)`,
        );
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Get typical medication frequencies
   */
  getMedicationFrequencies(): { [key: string]: string[] } {
    return {
      'Once daily': ['omeprazole', 'meloxicam', 'azithromycin'],
      'Twice daily': ['carprofen', 'doxycycline', 'enrofloxacin', 'metronidazole'],
      'Three times daily': [
        'amoxicillin',
        'tramadol',
        'gabapentin',
        'cephalexin',
      ],
      'As needed': ['diphenhydramine', 'tramadol'],
      'Every 72 hours': ['azithromycin'],
    };
  }

  /**
   * Calculate refill date based on dosage and refill amount
   */
  calculateRefillDate(
    startDate: Date,
    frequency: string,
    quantity: number,
  ): Date {
    const refillDate = new Date(startDate);

    // Parse frequency and calculate days
    let daysSupply = 0;

    if (frequency.includes('once daily')) {
      daysSupply = quantity;
    } else if (frequency.includes('twice daily') || frequency.includes('2x')) {
      daysSupply = Math.floor(quantity / 2);
    } else if (
      frequency.includes('three times') ||
      frequency.includes('3x')
    ) {
      daysSupply = Math.floor(quantity / 3);
    } else {
      // Default to 30 days if frequency unclear
      daysSupply = 30;
    }

    refillDate.setDate(refillDate.getDate() + daysSupply);
    return refillDate;
  }
}

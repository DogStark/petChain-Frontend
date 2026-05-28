import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsDateString,
} from 'class-validator';

export enum BehaviorType {
  AGGRESSION = 'aggression',
  ANXIETY = 'anxiety',
  APPETITE_CHANGE = 'appetite_change',
  ENERGY_LEVEL = 'energy_level',
  GROOMING = 'grooming',
  LETHARGY = 'lethargy',
  SOCIALIZATION = 'socialization',
  TRAINING = 'training',
  OTHER = 'other',
}

export enum BehaviorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * DTO for creating a new behavior log entry.
 *
 * @example
 * {
 *   "petId": "550e8400-e29b-41d4-a716-446655440000",
 *   "behaviorType": "aggression",
 *   "description": "Growled at another dog during walk",
 *   "severity": "medium",
 *   "notes": "Occurred near the park entrance",
 *   "observedAt": "2026-05-27T10:00:00Z"
 * }
 */
export class CreateBehaviorLogDto {
  /** UUID of the pet this behavior log belongs to. */
  @IsUUID()
  petId: string;

  /** Categorized behavior type. */
  @IsEnum(BehaviorType)
  behaviorType: BehaviorType;

  /** Human-readable description of the observed behavior. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  /** Optional severity level of the behavior. */
  @IsOptional()
  @IsEnum(BehaviorSeverity)
  severity?: BehaviorSeverity;

  /**
   * Optional intensity score on a 1–10 scale.
   * Useful for tracking trends over time.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  intensity?: number;

  /** Optional free-form notes from the observer (vet or owner). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /**
   * ISO-8601 timestamp of when the behavior was observed.
   * Defaults to the time of record creation if omitted.
   */
  @IsOptional()
  @IsDateString()
  observedAt?: string;
}

export interface EmergencyFieldVisibility {
  medicalNotes?: boolean;
  contacts?: boolean;
  emergencyVet?: boolean;
  poisonControl?: boolean;
  customMessage?: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  priority: number;
  isPublic?: boolean;
}

export interface EmergencyVet {
  name: string;
  phone: string;
  address: string;
  is24Hours: boolean;
  notes?: string;
  isPublic?: boolean;
}

export interface PoisonControl {
  name: string;
  phone: string;
  website?: string;
  isPublic?: boolean;
}

export interface PetEmergencyInfo {
  petId: string;
  contacts: EmergencyContact[];
  emergencyVet?: EmergencyVet;
  poisonControl?: PoisonControl;
  medicalNotes?: string; // Critical info like "Allergic to Penicillin"
  visibility?: EmergencyFieldVisibility;
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  avatarUrl?: string;
  ownerId: string;
  status: 'active' | 'missing' | 'deceased';
  emergencyInfo?: PetEmergencyInfo;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  priority: number;
}

export interface EmergencyVet {
  name: string;
  phone: string;
  address: string;
  is24Hours: boolean;
  notes?: string;
}

export interface PoisonControl {
  name: string;
  phone: string;
  website?: string;
}

export interface PetEmergencyInfo {
  petId: string;
  contacts: EmergencyContact[];
  emergencyVet?: EmergencyVet;
  poisonControl?: PoisonControl;
  medicalNotes?: string; // Critical info like "Allergic to Penicillin"
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

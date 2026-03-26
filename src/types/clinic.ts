export interface ClinicLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface OperatingHours {
  day:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  open: string; // HH:mm
  close: string; // HH:mm
  isClosed: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  specialty: string[];
  bio?: string;
  avatar?: string;
  clinicId: string;
}

export interface ClinicService {
  id: string;
  name: string;
  description: string;
  priceRange: string;
  duration?: number;
}

export interface ClinicReview {
  id: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface Clinic {
  id: string;
  name: string;
  description: string;
  logo?: string;
  mainImage?: string;
  locations: ClinicLocation[];
  hours: OperatingHours[];
  services: ClinicService[];
  staff: StaffMember[];
  rating: number;
  reviewCount: number;
  reviews?: ClinicReview[];
}

export type LabCategory =
  | "Blood Work"
  | "Urinalysis"
  | "Imaging"
  | "Cytology"
  | "Microbiology"
  | "Other";

export interface ReferenceRange {
  min: number;
  max: number;
  unit: string;
}

export interface LabResultItem {
  id: string;
  testName: string;
  value: number | string;
  category: LabCategory;
  date: string; // ISO string
  referenceRange?: ReferenceRange;
  isAbnormal?: boolean;
}

export interface LabReport {
  id: string;
  reportName: string;
  uploadDate: string; // ISO string
  pdfUrl?: string; // S3 or IPFS url
  results: LabResultItem[];
  veterinarianName?: string;
  notes?: string;
}

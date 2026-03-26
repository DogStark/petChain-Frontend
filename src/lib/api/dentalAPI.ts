// ─── Types ──────────────────────────────────────────────────────────────────

export type ToothStatus = 'healthy' | 'cavity' | 'missing' | 'treated' | 'fractured' | 'tartar';
export type IssueSeverity = 'mild' | 'moderate' | 'severe';
export type IssueStatus = 'active' | 'monitoring' | 'resolved';
export type ReminderType = 'cleaning' | 'exam' | 'follow_up' | 'medication';

export interface ToothRecord {
  toothId: number; // 1–42 for dogs, 1–30 for cats
  label: string;
  status: ToothStatus;
  notes?: string;
  lastUpdated: string;
}

export interface DentalExam {
  id: string;
  petId: string;
  date: string;
  vetName: string;
  clinic: string;
  overallScore: number; // 1-10
  plaqueLevel: 'none' | 'mild' | 'moderate' | 'severe';
  tartarLevel: 'none' | 'mild' | 'moderate' | 'severe';
  gingivitisLevel: 'none' | 'mild' | 'moderate' | 'severe';
  notes: string;
  toothChart: ToothRecord[];
  nextExamDate: string;
}

export interface CleaningRecord {
  id: string;
  petId: string;
  date: string;
  vetName: string;
  clinic: string;
  type: 'professional' | 'home';
  anesthesiaUsed: boolean;
  teethExtracted: number[];
  notes: string;
  cost?: number;
}

export interface DentalIssue {
  id: string;
  petId: string;
  toothId?: number;
  issueType: string;
  severity: IssueSeverity;
  status: IssueStatus;
  diagnosedDate: string;
  resolvedDate?: string;
  treatment?: string;
  notes: string;
}

export interface DentalReminder {
  id: string;
  petId: string;
  type: ReminderType;
  title: string;
  description: string;
  dueDate: string;
  isCompleted: boolean;
  completedDate?: string;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const buildDefaultToothChart = (): ToothRecord[] => {
  const statuses: ToothStatus[] = ['healthy', 'healthy', 'healthy', 'tartar', 'healthy', 'cavity', 'healthy', 'healthy', 'healthy', 'missing', 'healthy', 'treated'];
  return Array.from({ length: 42 }, (_, i) => ({
    toothId: i + 1,
    label: `T${i + 1}`,
    status: i < statuses.length ? statuses[i] : 'healthy',
    lastUpdated: '2024-12-15',
  }));
};

export const MOCK_DENTAL_EXAMS: DentalExam[] = [
  {
    id: 'exam-001',
    petId: 'pet-001',
    date: '2025-01-15',
    vetName: 'Dr. Sarah Chen',
    clinic: 'PawsCare Veterinary Clinic',
    overallScore: 7,
    plaqueLevel: 'mild',
    tartarLevel: 'moderate',
    gingivitisLevel: 'none',
    notes: 'Good overall dental health. Some tartar buildup on molars. Professional cleaning recommended within 3 months.',
    toothChart: buildDefaultToothChart(),
    nextExamDate: '2025-07-15',
  },
  {
    id: 'exam-002',
    petId: 'pet-001',
    date: '2024-07-10',
    vetName: 'Dr. James Miller',
    clinic: 'Happy Tails Animal Hospital',
    overallScore: 6,
    plaqueLevel: 'moderate',
    tartarLevel: 'moderate',
    gingivitisLevel: 'mild',
    notes: 'Plaque accumulation noted on upper premolars. Recommend daily brushing and dental chews.',
    toothChart: buildDefaultToothChart(),
    nextExamDate: '2025-01-10',
  },
];

export const MOCK_CLEANINGS: CleaningRecord[] = [
  {
    id: 'clean-001',
    petId: 'pet-001',
    date: '2025-02-01',
    vetName: 'Dr. Sarah Chen',
    clinic: 'PawsCare Veterinary Clinic',
    type: 'professional',
    anesthesiaUsed: true,
    teethExtracted: [],
    notes: 'Full scaling and polishing performed. No extractions needed. Healing well.',
    cost: 420,
  },
  {
    id: 'clean-002',
    petId: 'pet-001',
    date: '2024-08-20',
    vetName: 'Dr. James Miller',
    clinic: 'Happy Tails Animal Hospital',
    type: 'professional',
    anesthesiaUsed: true,
    teethExtracted: [10],
    notes: 'Scaling completed. Tooth #10 (lower left molar) extracted due to severe decay.',
    cost: 580,
  },
  {
    id: 'clean-003',
    petId: 'pet-001',
    date: '2025-01-10',
    vetName: 'Owner',
    clinic: 'Home',
    type: 'home',
    anesthesiaUsed: false,
    teethExtracted: [],
    notes: 'Daily brushing routine maintained. Used enzymatic toothpaste.',
    cost: 0,
  },
];

export const MOCK_ISSUES: DentalIssue[] = [
  {
    id: 'issue-001',
    petId: 'pet-001',
    toothId: 6,
    issueType: 'Cavity',
    severity: 'moderate',
    status: 'active',
    diagnosedDate: '2025-01-15',
    treatment: 'Dental filling scheduled for next visit',
    notes: 'Small cavity on tooth #6. Monitor closely. Scheduled for treatment.',
  },
  {
    id: 'issue-002',
    petId: 'pet-001',
    toothId: 4,
    issueType: 'Tartar Buildup',
    severity: 'mild',
    status: 'monitoring',
    diagnosedDate: '2024-07-10',
    treatment: 'Daily brushing and dental chews',
    notes: 'Tartar on upper premolars improving with home care routine.',
  },
  {
    id: 'issue-003',
    petId: 'pet-001',
    toothId: 10,
    issueType: 'Tooth Decay',
    severity: 'severe',
    status: 'resolved',
    diagnosedDate: '2024-06-05',
    resolvedDate: '2024-08-20',
    treatment: 'Tooth extraction',
    notes: 'Severe decay led to extraction. Area healed successfully.',
  },
];

export const MOCK_REMINDERS: DentalReminder[] = [
  {
    id: 'rem-001',
    petId: 'pet-001',
    type: 'exam',
    title: '6-Month Dental Exam Due',
    description: 'Schedule annual dental exam with Dr. Sarah Chen at PawsCare.',
    dueDate: '2025-07-15',
    isCompleted: false,
  },
  {
    id: 'rem-002',
    petId: 'pet-001',
    type: 'cleaning',
    title: 'Professional Cleaning',
    description: 'Book follow-up cleaning session as recommended by vet.',
    dueDate: '2025-05-01',
    isCompleted: false,
  },
  {
    id: 'rem-003',
    petId: 'pet-001',
    type: 'follow_up',
    title: 'Cavity Follow-up',
    description: 'Return to clinic for filling on tooth #6.',
    dueDate: '2025-03-10',
    isCompleted: false,
  },
  {
    id: 'rem-004',
    petId: 'pet-001',
    type: 'cleaning',
    title: 'Home Brushing Session',
    description: 'Daily enzymatic toothbrush routine.',
    dueDate: '2025-02-21',
    isCompleted: true,
    completedDate: '2025-02-20',
  },
];

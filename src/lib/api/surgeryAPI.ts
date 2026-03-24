import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export enum SurgeryStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface Surgery {
  id: string;
  petId: string;
  vetId?: string;
  surgeryType: string;
  surgeryDate: string;
  status: SurgeryStatus;
  preOpNotes?: string;
  postOpNotes?: string;
  anesthesiaDetails?: {
    type?: string;
    dosage?: string;
    duration?: number;
    complications?: string;
  };
  complications?: string[];
  recoveryTimeline?: {
    expectedDays?: number;
    milestones?: Array<{ date: string; description: string; completed: boolean }>;
  };
  photos?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSurgeryDto {
  petId: string;
  vetId?: string;
  surgeryType: string;
  surgeryDate: string;
  status?: SurgeryStatus;
  preOpNotes?: string;
  postOpNotes?: string;
  anesthesiaDetails?: {
    type?: string;
    dosage?: string;
    duration?: number;
    complications?: string;
  };
  complications?: string[];
  recoveryTimeline?: {
    expectedDays?: number;
    milestones?: Array<{ date: string; description: string; completed: boolean }>;
  };
}

class SurgeryAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/surgeries`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async create(data: CreateSurgeryDto, photos?: File[]): Promise<Surgery> {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });

    if (photos) {
      photos.forEach((photo) => formData.append('photos', photo));
    }

    const response = await this.api.post('/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async findAll(petId?: string, status?: SurgeryStatus): Promise<Surgery[]> {
    const response = await this.api.get('/', { params: { petId, status } });
    return response.data;
  }

  async findOne(id: string): Promise<Surgery> {
    const response = await this.api.get(`/${id}`);
    return response.data;
  }

  async update(id: string, data: Partial<CreateSurgeryDto>, photos?: File[]): Promise<Surgery> {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });

    if (photos) {
      photos.forEach((photo) => formData.append('photos', photo));
    }

    const response = await this.api.patch(`/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/${id}`);
  }
}

export const surgeryAPI = new SurgeryAPI();

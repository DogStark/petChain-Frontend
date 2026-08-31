import axios, { AxiosInstance } from 'axios';
import { Pet, PetEmergencyInfo } from '@/types/pet';
import { getApiBaseUrl } from './apiBaseUrl';
import { projectEmergencyProfile } from '@/utils/emergencyProjection';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class PetAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/pets`,
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

  async getUserPets(): Promise<Pet[]> {
    const response = await this.api.get('/me');
    return response.data;
  }

  async getPetEmergencyInfo(petId: string): Promise<PetEmergencyInfo | null> {
    if (!UUID_RE.test(petId)) throw new Error('Invalid petId');
    try {
      const response = await this.api.get(`/${petId}/emergency`);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Owner hasn't configured emergency info yet — return null so callers
        // can show a "no info configured" state instead of fake data.
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetches the projected emergency info for anonymous scanners,
   * containing only fields that the owner has explicitly set to public.
   */
  async getPetEmergencyInfoProjection(petId: string): Promise<PetEmergencyInfo | null> {
    if (!UUID_RE.test(petId)) throw new Error('Invalid petId');
    try {
      // Best effort to call projection endpoint if available, fallback to client-side projection
      const response = await this.api.get(`/${petId}/emergency/projection`);
      return projectEmergencyProfile(response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Fall back to getPetEmergencyInfo + client-side projection
        const full = await this.getPetEmergencyInfo(petId);
        return projectEmergencyProfile(full);
      }
      const full = await this.getPetEmergencyInfo(petId);
      return projectEmergencyProfile(full);
    }
  }

  async updatePetEmergencyInfo(petId: string, info: PetEmergencyInfo): Promise<PetEmergencyInfo> {
    if (!UUID_RE.test(petId)) throw new Error('Invalid petId');
    const response = await this.api.put(`/${petId}/emergency`, info);
    return response.data;
  }
}

export const petAPI = new PetAPI();

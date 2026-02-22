import axios, { AxiosInstance } from 'axios';
import { PetEmergencyInfo } from '../types/pet';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class PetAPI {
    private api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: `${API_BASE_URL}/pets`,
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

    async getPetEmergencyInfo(petId: string): Promise<PetEmergencyInfo> {
        try {
            const response = await this.api.get(`/${petId}/emergency`);
            return response.data;
        } catch (error: any) {
            if (error?.response?.status === 404) {
                // Return mock data for demo if not found
                return this.getMockEmergencyInfo(petId);
            }
            throw error;
        }
    }

    async updatePetEmergencyInfo(petId: string, info: PetEmergencyInfo): Promise<PetEmergencyInfo> {
        const response = await this.api.put(`/${petId}/emergency`, info);
        return response.data;
    }

    private getMockEmergencyInfo(petId: string): PetEmergencyInfo {
        return {
            petId,
            contacts: [
                {
                    id: '1',
                    name: 'Jane Doe',
                    relationship: 'Co-owner',
                    phone: '+1 (555) 123-4567',
                    email: 'jane@example.com',
                    priority: 1,
                },
                {
                    id: '2',
                    name: 'Bob Smith',
                    relationship: 'Neighbor',
                    phone: '+1 (555) 987-6543',
                    priority: 2,
                }
            ],
            emergencyVet: {
                name: 'City Emergency Vet',
                phone: '+1 (555) 000-9999',
                address: '789 Rescue Lane, Pet City, PC 12345',
                is24Hours: true,
                notes: 'They have Max\'s records on file.'
            },
            poisonControl: {
                name: 'ASPCA Poison Control',
                phone: '(888) 426-4435',
                website: 'https://www.aspca.org/pet-care/animal-poison-control'
            },
            medicalNotes: 'No known allergies. Up to date on all shots.'
        };
    }
}

export const petAPI = new PetAPI();

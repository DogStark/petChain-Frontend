import axios, { AxiosInstance, AxiosProgressEvent } from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface PetPhoto {
  id: string;
  petId: string;
  photoUrl: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  displayOrder: number;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
}

class PetPhotosAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
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

  async getPhotos(petId: string): Promise<PetPhoto[]> {
    const response = await this.api.get(`/pets/${petId}/photos`);
    return response.data;
  }

  async uploadPhotos(
    petId: string,
    files: File[],
    onProgress?: (progress: number) => void,
  ): Promise<PetPhoto[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));

    const response = await this.api.post(`/pets/${petId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });
    return response.data;
  }

  async setPrimary(petId: string, photoId: string): Promise<PetPhoto> {
    const response = await this.api.patch(
      `/pets/${petId}/photos/${photoId}/primary`,
    );
    return response.data;
  }

  async reorderPhotos(petId: string, photoIds: string[]): Promise<PetPhoto[]> {
    const response = await this.api.put(`/pets/${petId}/photos/reorder`, {
      photoIds,
    });
    return response.data;
  }

  async deletePhoto(petId: string, photoId: string): Promise<void> {
    await this.api.delete(`/pets/${petId}/photos/${photoId}`);
  }
}

export const petPhotosAPI = new PetPhotosAPI();

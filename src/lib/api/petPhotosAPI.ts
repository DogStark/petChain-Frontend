import axios, { AxiosInstance, AxiosProgressEvent } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

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
      baseURL: getApiBaseUrl(),
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

  /**
   * Upload photos to the server.
   *
   * @param petId        Target pet ID.
   * @param files        Compressed, metadata-stripped files ready for upload.
   * @param onProgress   Optional progress callback (0–100).
   * @param signal       Optional AbortSignal for cancellation (issue #877).
   */
  async uploadPhotos(
    petId: string,
    files: File[],
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
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
      // Axios accepts an AbortSignal in its config (axios >= 0.22)
      signal,
    });
    return response.data;
  }

  async setPrimary(petId: string, photoId: string): Promise<PetPhoto> {
    const response = await this.api.patch(`/pets/${petId}/photos/${photoId}/primary`);
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

import axios, { AxiosInstance, AxiosProgressEvent } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';

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

export interface PhotoUploadProgress {
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export function mergePhotoUploadProgress(
  previous: PhotoUploadProgress,
  next: PhotoUploadProgress
): PhotoUploadProgress {
  const nextPercent = next.percent === undefined
    ? previous.percent
    : Math.max(previous.percent ?? 0, Math.min(100, next.percent));
  return {
    loadedBytes: Math.max(previous.loadedBytes, next.loadedBytes),
    totalBytes: next.totalBytes,
    percent: nextPercent,
  };
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

    attachCorrelationInterceptor(this.api);
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
  * @param onProgress   Optional progress callback with byte counts and an optional percentage.
   * @param signal       Optional AbortSignal for cancellation (issue #877).
  * @param idempotencyKey Stable key reused when retrying the same batch.
   */
  async uploadPhotos(
    petId: string,
    files: File[],
    onProgress?: (progress: PhotoUploadProgress) => void,
    signal?: AbortSignal,
    idempotencyKey?: string
  ): Promise<PetPhoto[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));

    const response = await this.api.post(`/pets/${petId}/photos`, formData, {
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (onProgress) {
          const totalBytes = event.total && event.total > 0 ? event.total : undefined;
          onProgress({
            loadedBytes: event.loaded,
            totalBytes,
            percent: totalBytes ? Math.min(100, Math.round((event.loaded * 100) / totalBytes)) : undefined,
          });
        }
      },
      // Axios accepts an AbortSignal in its config (axios >= 0.22)
      signal,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
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

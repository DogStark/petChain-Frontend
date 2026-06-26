import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

export interface Review {
  reviewer: string;
  rating: number;
  comment: string;
  timestamp: number;
  transaction_hash: string;
}

export interface RatingStats {
  total_reviews: number;
  average_rating: number;
  rating_counts: number[];
}

export interface SubmitReviewResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

class RatingAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/ratings`,
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

  async submitReview(rating: number, comment: string): Promise<SubmitReviewResponse> {
    const response = await this.api.post('/reviews', { rating, comment });
    return response.data;
  }

  async getUserReview(userAddress: string): Promise<Review | null> {
    try {
      const response = await this.api.get(`/reviews/${userAddress}`);
      return response.data;
    } catch {
      return null;
    }
  }

  async getAllReviews(): Promise<Review[]> {
    const response = await this.api.get('/reviews');
    return response.data;
  }

  async getRatingStats(): Promise<RatingStats> {
    const response = await this.api.get('/stats');
    return response.data;
  }

  async verifyReview(userAddress: string, txHash: string): Promise<boolean> {
    const response = await this.api.post('/verify', { userAddress, txHash });
    return response.data.valid;
  }
}

export const ratingAPI = new RatingAPI();

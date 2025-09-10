import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { ApiResponse } from '../types/storm';
import { ApiErrorHandler, EnhancedError } from '../lib/error-handling';

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  rateLimitPerSecond?: number;
}

export interface RequestOptions extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipRetry?: boolean;
  skipRateLimit?: boolean;
}

export class ApiError extends Error {
  public status?: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BaseApiService {
  protected client: AxiosInstance;
  private config: ApiConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;

  constructor(config: ApiConfig) {
    this.config = config;

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication and rate limiting
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Debug logging
        if (process.env.NEXT_PUBLIC_API_DEBUG === 'true') {
          console.log('🔄 API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
            data: config.data,
          });
        }

        // Add authentication token if available
        const token = this.getAuthToken();
        if (token && !(config as any).skipAuth) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add API key if available
        const apiKey = this.getApiKey();
        if (apiKey) {
          config.headers['X-API-Key'] = apiKey;
        }

        // Rate limiting
        if (!(config as any).skipRateLimit && this.config.rateLimitPerSecond) {
          await this.enforceRateLimit();
        }

        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling and retries
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Debug logging
        if (process.env.NEXT_PUBLIC_API_DEBUG === 'true') {
          console.log('✅ API Response:', {
            status: response.status,
            url: response.config.url,
            method: response.config.method?.toUpperCase(),
            data: response.data,
          });
        }

        // Transform response to our ApiResponse format
        return {
          ...response,
          data: this.transformResponse(response.data),
        };
      },
      async (error: AxiosError) => {
        const config = error.config as any;

        // Debug logging for errors
        if (process.env.NEXT_PUBLIC_API_DEBUG === 'true') {
          console.error('❌ API Error:', {
            status: error.response?.status,
            url: error.config?.url,
            method: error.config?.method?.toUpperCase(),
            message: error.message,
            data: error.response?.data,
          });
        }

        // Retry logic
        if (this.shouldRetry(error) && !config?.skipRetry) {
          const retryAttempts = config._retryCount || 0;

          if (retryAttempts < (this.config.retryAttempts || 3)) {
            config._retryCount = retryAttempts + 1;

            // Exponential backoff
            const delay =
              (this.config.retryDelay || 1000) * Math.pow(2, retryAttempts);
            await this.sleep(delay);

            return this.client(config);
          }
        }

        // Transform error to our ApiError format
        throw this.transformError(error);
      }
    );
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('storm_auth_token') ||
        sessionStorage.getItem('storm_auth_token')
      );
    }
    return null;
  }

  private getApiKey(): string | null {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('storm_api_key') ||
        sessionStorage.getItem('storm_api_key')
      );
    }
    return null;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / (this.config.rateLimitPerSecond || 10);

    if (timeSinceLastRequest < minInterval) {
      await this.sleep(minInterval - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors, timeout, or 5xx server errors
    return (
      !error.response ||
      error.code === 'ECONNABORTED' ||
      (error.response.status >= 500 && error.response.status < 600) ||
      error.response.status === 429 // Rate limited
    );
  }

  private transformResponse<T>(data: any): ApiResponse<T> {
    // If data is already in ApiResponse format, return as-is
    if (data && typeof data === 'object' && 'success' in data) {
      return {
        ...data,
        timestamp: new Date(data.timestamp || Date.now()),
      };
    }

    // Transform raw data to ApiResponse format
    return {
      success: true,
      data: data,
      timestamp: new Date(),
    };
  }

  private transformError(error: AxiosError): ApiError {
    const response = error.response;
    const data = response?.data as any;

    let message = 'An unexpected error occurred';
    const status = response?.status;
    let code = error.code;
    const details = data;

    if (data && typeof data === 'object') {
      message = data.error || data.message || message;
      code = data.code || code;
    } else if (error.message) {
      message = error.message;
    }

    // Handle specific error cases
    if (status === 401) {
      message = 'Authentication required';
    } else if (status === 403) {
      message = 'Access denied';
    } else if (status === 404) {
      message = 'Resource not found';
    } else if (status === 429) {
      message = 'Rate limit exceeded';
    } else if (status && status >= 500) {
      message = 'Server error occurred';
    }

    return new ApiError(message, status, code, details);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for making requests with enhanced error handling
  protected async get<T>(
    url: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.executeWithErrorHandling(
      () => this.client.get<ApiResponse<T>>(url, options).then(r => r.data),
      'GET',
      url
    );
  }

  protected async post<T>(
    url: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.executeWithErrorHandling(
      () =>
        this.client.post<ApiResponse<T>>(url, data, options).then(r => r.data),
      'POST',
      url,
      { data }
    );
  }

  protected async put<T>(
    url: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.executeWithErrorHandling(
      () =>
        this.client.put<ApiResponse<T>>(url, data, options).then(r => r.data),
      'PUT',
      url,
      { data }
    );
  }

  protected async patch<T>(
    url: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.executeWithErrorHandling(
      () =>
        this.client.patch<ApiResponse<T>>(url, data, options).then(r => r.data),
      'PATCH',
      url,
      { data }
    );
  }

  protected async delete<T>(
    url: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.executeWithErrorHandling(
      () => this.client.delete<ApiResponse<T>>(url, options).then(r => r.data),
      'DELETE',
      url
    );
  }

  /**
   * Execute API request with enhanced error handling
   */
  private async executeWithErrorHandling<T>(
    operation: () => Promise<ApiResponse<T>>,
    method: string,
    url: string,
    context?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      return await operation();
    } catch (error) {
      const enhancedError = ApiErrorHandler.enhance(error, `${method} ${url}`, {
        method,
        url,
        ...context,
      });

      ApiErrorHandler.log(enhancedError);
      throw enhancedError;
    }
  }

  /**
   * Execute operation with automatic retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<ApiResponse<T>>,
    operationName: string,
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      context?: Record<string, any>;
    }
  ): Promise<ApiResponse<T>> {
    return ApiErrorHandler.handleWithRetry(operation, operationName, options);
  }

  // Utility methods
  public setAuthToken(token: string, persistent = false): void {
    if (typeof window !== 'undefined') {
      const storage = persistent ? localStorage : sessionStorage;
      storage.setItem('storm_auth_token', token);
    }
  }

  public clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('storm_auth_token');
      sessionStorage.removeItem('storm_auth_token');
    }
  }

  public setApiKey(apiKey: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('storm_api_key', apiKey);
    }
  }

  public clearApiKey(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('storm_api_key');
    }
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health', { skipAuth: true, skipRetry: true });
      return true;
    } catch {
      return false;
    }
  }

  // Upload file method
  protected async uploadFile<T>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const config: AxiosRequestConfig = {
      ...options,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...options?.headers,
      },
      onUploadProgress: progressEvent => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    };

    const response = await this.client.post<ApiResponse<T>>(
      url,
      formData,
      config
    );
    return response.data;
  }

  // Download file method
  protected async downloadFile(
    url: string,
    filename?: string,
    onProgress?: (progress: number) => void,
    options?: RequestOptions
  ): Promise<Blob> {
    const config: AxiosRequestConfig = {
      ...options,
      responseType: 'blob',
      onDownloadProgress: progressEvent => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    };

    const response = await this.client.get(url, config);

    // Auto-download if filename is provided and we're in browser
    if (filename && typeof window !== 'undefined') {
      const blob = response.data;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    }

    return response.data;
  }
}

// Default API configuration
export const DEFAULT_API_CONFIG: ApiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.NEXT_PUBLIC_API_RETRY_DELAY || '1000'),
  rateLimitPerSecond: parseInt(process.env.NEXT_PUBLIC_API_RATE_LIMIT || '10'),
};

// Singleton instance
let apiInstance: BaseApiService | null = null;

export function getApiService(config?: Partial<ApiConfig>): BaseApiService {
  if (!apiInstance) {
    apiInstance = new BaseApiService({ ...DEFAULT_API_CONFIG, ...config });
  }
  return apiInstance;
}

export function resetApiService(): void {
  apiInstance = null;
}

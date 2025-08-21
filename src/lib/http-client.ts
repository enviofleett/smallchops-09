import { withTimeout, isNetworkError, getRetryDelay, isOnline } from '@/utils/networkUtils';

interface HttpOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  skipRetryOn?: number[];
}

interface RequestMetrics {
  url: string;
  startTime: number;
  attempts: number;
  method: string;
}

export class HttpClient {
  private static baseOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  static async request<T = any>(
    url: string, 
    options: HttpOptions = {}
  ): Promise<T> {
    const {
      timeout = 8000,
      retries = 2,
      retryDelay = 1000,
      skipRetryOn = [400, 401, 403, 404, 422],
      ...fetchOptions
    } = options;

    // Check online status for non-critical requests
    if (!isOnline() && !fetchOptions.method?.match(/POST|PUT|PATCH|DELETE/)) {
      throw new Error('Offline - request skipped');
    }

    const metrics: RequestMetrics = {
      url,
      startTime: Date.now(),
      attempts: 0,
      method: fetchOptions.method || 'GET'
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      metrics.attempts = attempt + 1;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...this.baseOptions,
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).response = response;

          // Don't retry client errors
          if (skipRetryOn.includes(response.status)) {
            this.logRequest(metrics, false, error);
            throw error;
          }

          // Retry server errors
          if (attempt < retries) {
            console.warn(`Request attempt ${attempt + 1} failed with status ${response.status}, retrying...`);
            await this.delay(getRetryDelay(attempt, retryDelay));
            continue;
          }

          this.logRequest(metrics, false, error);
          throw error;
        }

        const data = await response.json();
        this.logRequest(metrics, true);
        return data;

      } catch (error: any) {
        // Handle AbortError (timeout)
        if (error.name === 'AbortError') {
          const timeoutError = new Error(`Request timeout after ${timeout}ms`);
          if (attempt < retries) {
            console.warn(`Request attempt ${attempt + 1} timed out, retrying...`);
            await this.delay(getRetryDelay(attempt, retryDelay));
            continue;
          }
          this.logRequest(metrics, false, timeoutError);
          throw timeoutError;
        }

        // Handle network errors
        if (isNetworkError(error)) {
          if (attempt < retries) {
            console.warn(`Network error on attempt ${attempt + 1}, retrying...`);
            await this.delay(getRetryDelay(attempt, retryDelay));
            continue;
          }
        }

        this.logRequest(metrics, false, error);
        throw error;
      }
    }

    throw new Error('Unexpected error: retries exhausted without throwing');
  }

  static async get<T = any>(url: string, options: Omit<HttpOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  static async post<T = any>(url: string, data?: any, options: Omit<HttpOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async put<T = any>(url: string, data?: any, options: Omit<HttpOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T = any>(url: string, options: Omit<HttpOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static logRequest(metrics: RequestMetrics, success: boolean, error?: any): void {
    const duration = Date.now() - metrics.startTime;
    const status = success ? '✅' : '❌';
    
    console.debug(`${status} ${metrics.method} ${metrics.url} - ${duration}ms (${metrics.attempts} attempts)`, 
      error ? { error: error.message } : {}
    );
  }
}

export default HttpClient;
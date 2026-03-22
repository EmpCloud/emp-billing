// ============================================================================
// HTTP Client — thin wrapper around native fetch (Node 18+)
// ============================================================================

import {
  BillingApiError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  ForbiddenError,
} from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiErrorBody {
  success: false;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

interface ApiSuccessBody<T> {
  success: true;
  data?: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export interface HttpClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
}

export interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** If true, return the raw Response instead of parsed JSON. */
  raw?: boolean;
}

// ---------------------------------------------------------------------------
// HttpClient
// ---------------------------------------------------------------------------

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: HttpClientOptions) {
    // Strip trailing slash from base URL
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeout = options.timeout;
    this.maxRetries = options.maxRetries;
  }

  /**
   * Execute an HTTP request with automatic retries on 429 and 5xx.
   */
  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": "@empcloud/billing-sdk/0.1.0",
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Return raw response for binary endpoints (e.g. PDF download)
        if (options.raw) {
          return response as unknown as T;
        }

        // Handle success (2xx)
        if (response.ok) {
          const json = (await response.json()) as ApiSuccessBody<T>;

          // For paginated endpoints, the caller expects the full wrapper.
          // For single-resource endpoints, the caller expects just the data.
          // We return the raw JSON and let resource methods unwrap as needed.
          return json as unknown as T;
        }

        // Handle errors
        const errorBody = await this.safeParseJson<ApiErrorBody>(response);

        // 429 — rate limited, retry with backoff
        if (response.status === 429) {
          const retryAfter = this.parseRetryAfter(response);
          if (attempt < this.maxRetries) {
            const delay = retryAfter
              ? retryAfter * 1000
              : this.exponentialBackoff(attempt);
            await this.sleep(delay);
            continue;
          }
          throw new RateLimitError(
            errorBody?.error?.message ?? "Rate limit exceeded",
            retryAfter,
          );
        }

        // 5xx — server error, retry with backoff
        if (response.status >= 500 && attempt < this.maxRetries) {
          await this.sleep(this.exponentialBackoff(attempt));
          continue;
        }

        // 401
        if (response.status === 401) {
          throw new AuthenticationError(
            errorBody?.error?.message ?? "Invalid or missing API key",
          );
        }

        // 403
        if (response.status === 403) {
          throw new ForbiddenError(
            errorBody?.error?.message ?? "Insufficient permissions",
          );
        }

        // 404
        if (response.status === 404) {
          throw new NotFoundError(
            errorBody?.error?.message ?? "Resource not found",
          );
        }

        // 422 — validation error
        if (response.status === 422) {
          throw new ValidationError(
            errorBody?.error?.message ?? "Validation failed",
            errorBody?.error?.details ?? {},
          );
        }

        // All other errors
        throw new BillingApiError(
          response.status,
          errorBody?.error?.code ?? "UNKNOWN_ERROR",
          errorBody?.error?.message ?? `Request failed with status ${response.status}`,
          errorBody?.error?.details,
        );
      } catch (err) {
        if (
          err instanceof BillingApiError ||
          err instanceof RateLimitError ||
          err instanceof ValidationError ||
          err instanceof NotFoundError ||
          err instanceof AuthenticationError ||
          err instanceof ForbiddenError
        ) {
          throw err;
        }

        // AbortController timeout
        if (err instanceof DOMException || (err as Error).name === "AbortError") {
          lastError = new BillingApiError(
            0,
            "TIMEOUT",
            `Request timed out after ${this.timeout}ms`,
          );
          if (attempt < this.maxRetries) {
            await this.sleep(this.exponentialBackoff(attempt));
            continue;
          }
          throw lastError;
        }

        // Network / fetch errors — retry
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          await this.sleep(this.exponentialBackoff(attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error("Request failed after all retries");
  }

  // -------------------------------------------------------------------------
  // Convenience methods
  // -------------------------------------------------------------------------

  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>({ method: "GET", path, query });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: "POST", path, body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: "PUT", path, body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: "PATCH", path, body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>({ method: "DELETE", path });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async safeParseJson<T>(response: Response): Promise<T | null> {
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  private parseRetryAfter(response: Response): number | null {
    const header = response.headers.get("retry-after");
    if (!header) return null;
    const seconds = parseInt(header, 10);
    return isNaN(seconds) ? null : seconds;
  }

  private exponentialBackoff(attempt: number): number {
    // Exponential backoff: 500ms, 1s, 2s, 4s ... with jitter
    const base = Math.min(500 * Math.pow(2, attempt), 10000);
    const jitter = Math.random() * base * 0.1;
    return base + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

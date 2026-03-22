import { HttpClient } from "../http";
import type {
  Subscription,
  CreateSubscriptionData,
  PaginatedResult,
  ListSubscriptionsParams,
} from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export class SubscriptionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List subscriptions with optional filtering and pagination.
   */
  async list(params?: ListSubscriptionsParams): Promise<PaginatedResult<Subscription>> {
    const response = await this.http.get<ApiResponse<Subscription[]>>("/subscriptions", params as Record<string, string | number | boolean | undefined>);
    return {
      data: response.data ?? [],
      meta: response.meta ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  /**
   * Get a single subscription by ID.
   */
  async get(id: string): Promise<Subscription> {
    const response = await this.http.get<ApiResponse<Subscription>>(`/subscriptions/${id}`);
    return response.data!;
  }

  /**
   * Create a new subscription.
   */
  async create(data: CreateSubscriptionData): Promise<Subscription> {
    const response = await this.http.post<ApiResponse<Subscription>>("/subscriptions", data);
    return response.data!;
  }

  /**
   * Cancel a subscription.
   */
  async cancel(id: string, reason?: string): Promise<Subscription> {
    const response = await this.http.post<ApiResponse<Subscription>>(
      `/subscriptions/${id}/cancel`,
      reason ? { reason } : undefined,
    );
    return response.data!;
  }

  /**
   * Pause a subscription.
   */
  async pause(id: string, resumeDate?: string): Promise<Subscription> {
    const response = await this.http.post<ApiResponse<Subscription>>(
      `/subscriptions/${id}/pause`,
      resumeDate ? { resumeDate } : undefined,
    );
    return response.data!;
  }

  /**
   * Resume a paused subscription.
   */
  async resume(id: string): Promise<Subscription> {
    const response = await this.http.post<ApiResponse<Subscription>>(`/subscriptions/${id}/resume`);
    return response.data!;
  }

  /**
   * Change the plan of an existing subscription (upgrade or downgrade).
   */
  async changePlan(id: string, newPlanId: string): Promise<Subscription> {
    const response = await this.http.post<ApiResponse<Subscription>>(
      `/subscriptions/${id}/change-plan`,
      { planId: newPlanId },
    );
    return response.data!;
  }
}

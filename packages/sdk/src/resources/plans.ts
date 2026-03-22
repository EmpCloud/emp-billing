import { HttpClient } from "../http";
import type { Plan, CreatePlanData, PaginatedResult, ListParams } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export class PlansResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all plans.
   */
  async list(params?: ListParams): Promise<PaginatedResult<Plan>> {
    const response = await this.http.get<ApiResponse<Plan[]>>("/plans", params as Record<string, string | number | boolean | undefined>);
    return {
      data: response.data ?? [],
      meta: response.meta ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  /**
   * Get a single plan by ID.
   */
  async get(id: string): Promise<Plan> {
    const response = await this.http.get<ApiResponse<Plan>>(`/plans/${id}`);
    return response.data!;
  }

  /**
   * Create a new plan.
   */
  async create(data: CreatePlanData): Promise<Plan> {
    const response = await this.http.post<ApiResponse<Plan>>("/plans", data);
    return response.data!;
  }

  /**
   * Update an existing plan.
   */
  async update(id: string, data: Partial<CreatePlanData>): Promise<Plan> {
    const response = await this.http.put<ApiResponse<Plan>>(`/plans/${id}`, data);
    return response.data!;
  }

  /**
   * Delete a plan.
   */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/plans/${id}`);
  }
}

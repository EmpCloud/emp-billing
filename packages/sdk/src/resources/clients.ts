import { HttpClient } from "../http";
import type {
  Client,
  CreateClientData,
  AutoProvisionData,
  AutoProvisionResult,
  PaginatedResult,
  ListParams,
} from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export class ClientsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List clients with optional filtering and pagination.
   */
  async list(params?: ListParams): Promise<PaginatedResult<Client>> {
    const response = await this.http.get<ApiResponse<Client[]>>("/clients", params as Record<string, string | number | boolean | undefined>);
    return {
      data: response.data ?? [],
      meta: response.meta ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  /**
   * Get a single client by ID.
   */
  async get(id: string): Promise<Client> {
    const response = await this.http.get<ApiResponse<Client>>(`/clients/${id}`);
    return response.data!;
  }

  /**
   * Create a new client.
   */
  async create(data: CreateClientData): Promise<Client> {
    const response = await this.http.post<ApiResponse<Client>>("/clients", data);
    return response.data!;
  }

  /**
   * Update an existing client.
   */
  async update(id: string, data: Partial<CreateClientData>): Promise<Client> {
    const response = await this.http.put<ApiResponse<Client>>(`/clients/${id}`, data);
    return response.data!;
  }

  /**
   * Delete a client.
   */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/clients/${id}`);
  }

  /**
   * Auto-provision a client from an external system.
   * Creates the client if no match is found, otherwise returns the existing one.
   * Useful for SaaS platforms that need to lazily sync customers.
   */
  async autoProvision(data: AutoProvisionData): Promise<AutoProvisionResult> {
    const response = await this.http.post<ApiResponse<AutoProvisionResult>>(
      "/clients/auto-provision",
      data,
    );
    return response.data!;
  }
}

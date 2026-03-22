import { HttpClient } from "../http";
import type {
  Invoice,
  CreateInvoiceData,
  PaginatedResult,
  ListInvoicesParams,
} from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export class InvoicesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List invoices with optional filtering and pagination.
   */
  async list(params?: ListInvoicesParams): Promise<PaginatedResult<Invoice>> {
    const response = await this.http.get<ApiResponse<Invoice[]>>("/invoices", params as Record<string, string | number | boolean | undefined>);
    return {
      data: response.data ?? [],
      meta: response.meta ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  /**
   * Get a single invoice by ID.
   */
  async get(id: string): Promise<Invoice> {
    const response = await this.http.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    return response.data!;
  }

  /**
   * Create a new invoice.
   */
  async create(data: CreateInvoiceData): Promise<Invoice> {
    const response = await this.http.post<ApiResponse<Invoice>>("/invoices", data);
    return response.data!;
  }

  /**
   * Update an existing invoice.
   */
  async update(id: string, data: Partial<CreateInvoiceData>): Promise<Invoice> {
    const response = await this.http.put<ApiResponse<Invoice>>(`/invoices/${id}`, data);
    return response.data!;
  }

  /**
   * Send an invoice to the client via email.
   */
  async send(id: string): Promise<Invoice> {
    const response = await this.http.post<ApiResponse<Invoice>>(`/invoices/${id}/send`);
    return response.data!;
  }

  /**
   * Mark an invoice as void.
   */
  async void(id: string): Promise<Invoice> {
    const response = await this.http.post<ApiResponse<Invoice>>(`/invoices/${id}/void`);
    return response.data!;
  }

  /**
   * Download the invoice as a PDF.
   * Returns a Buffer containing the PDF bytes.
   */
  async downloadPdf(id: string): Promise<Buffer> {
    const response = await this.http.request<Response>({
      method: "GET",
      path: `/invoices/${id}/pdf`,
      raw: true,
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Delete a draft invoice.
   */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/invoices/${id}`);
  }
}

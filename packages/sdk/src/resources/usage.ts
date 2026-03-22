import { HttpClient } from "../http";
import type {
  UsageRecord,
  ReportUsageData,
  GenerateUsageInvoiceData,
  Invoice,
} from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
}

export class UsageResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Report usage for a metered product.
   * Usage records are accumulated and billed when an invoice is generated.
   */
  async report(data: ReportUsageData): Promise<UsageRecord> {
    const response = await this.http.post<ApiResponse<UsageRecord>>("/usage", data);
    return response.data!;
  }

  /**
   * Report multiple usage records in a single call.
   */
  async reportBatch(records: ReportUsageData[]): Promise<UsageRecord[]> {
    const response = await this.http.post<ApiResponse<UsageRecord[]>>("/usage/batch", {
      records,
    });
    return response.data!;
  }

  /**
   * Generate an invoice from unbilled usage records for a client and period.
   */
  async generateInvoice(data: GenerateUsageInvoiceData): Promise<Invoice> {
    const response = await this.http.post<ApiResponse<Invoice>>(
      "/usage/generate-invoice",
      data,
    );
    return response.data!;
  }
}

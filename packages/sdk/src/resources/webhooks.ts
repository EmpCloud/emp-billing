import { HttpClient } from "../http";
import type { Webhook, CreateWebhookData } from "../types";
import { createHmac, timingSafeEqual } from "node:crypto";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
}

export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all webhook subscriptions.
   */
  async list(): Promise<Webhook[]> {
    const response = await this.http.get<ApiResponse<Webhook[]>>("/webhooks");
    return response.data ?? [];
  }

  /**
   * Get a single webhook by ID.
   */
  async get(id: string): Promise<Webhook> {
    const response = await this.http.get<ApiResponse<Webhook>>(`/webhooks/${id}`);
    return response.data!;
  }

  /**
   * Create a new webhook subscription.
   */
  async create(data: CreateWebhookData): Promise<Webhook> {
    const response = await this.http.post<ApiResponse<Webhook>>("/webhooks", data);
    return response.data!;
  }

  /**
   * Update an existing webhook.
   */
  async update(id: string, data: Partial<CreateWebhookData>): Promise<Webhook> {
    const response = await this.http.put<ApiResponse<Webhook>>(`/webhooks/${id}`, data);
    return response.data!;
  }

  /**
   * Delete a webhook subscription.
   */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/webhooks/${id}`);
  }

  /**
   * Verify the signature of an incoming webhook payload.
   *
   * Use this in your webhook handler to ensure the request is genuine:
   *
   * ```ts
   * const isValid = billing.webhooks.verifySignature(
   *   rawBody,                          // raw request body string
   *   req.headers["x-empbilling-signature"], // signature header
   *   webhookSecret,                    // secret from webhook creation
   * );
   * ```
   *
   * The signature is an HMAC-SHA256 hex digest of the raw body using
   * the webhook secret as the key.
   */
  verifySignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const expected = createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expected, "hex");

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }
}

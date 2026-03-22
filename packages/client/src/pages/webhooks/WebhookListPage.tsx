import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Zap, Globe, ScrollText, ChevronDown, ChevronRight, RotateCw } from "lucide-react";
import { WebhookEvent } from "@emp-billing/shared";
import type { WebhookDelivery } from "@emp-billing/shared";
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useWebhookDeliveries,
  useRetryDelivery,
} from "@/api/hooks/webhook.hooks";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";

const WEBHOOK_EVENTS = Object.values(WebhookEvent);

const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  [WebhookEvent.INVOICE_CREATED]: "Invoice Created",
  [WebhookEvent.INVOICE_SENT]: "Invoice Sent",
  [WebhookEvent.INVOICE_VIEWED]: "Invoice Viewed",
  [WebhookEvent.INVOICE_PAID]: "Invoice Paid",
  [WebhookEvent.INVOICE_OVERDUE]: "Invoice Overdue",
  [WebhookEvent.PAYMENT_RECEIVED]: "Payment Received",
  [WebhookEvent.PAYMENT_REFUNDED]: "Payment Refunded",
  [WebhookEvent.QUOTE_CREATED]: "Quote Created",
  [WebhookEvent.QUOTE_ACCEPTED]: "Quote Accepted",
  [WebhookEvent.QUOTE_DECLINED]: "Quote Declined",
  [WebhookEvent.CLIENT_CREATED]: "Client Created",
  [WebhookEvent.EXPENSE_CREATED]: "Expense Created",
  [WebhookEvent.SUBSCRIPTION_CREATED]: "Subscription Created",
  [WebhookEvent.SUBSCRIPTION_ACTIVATED]: "Subscription Activated",
  [WebhookEvent.SUBSCRIPTION_TRIAL_ENDING]: "Subscription Trial Ending",
  [WebhookEvent.SUBSCRIPTION_RENEWED]: "Subscription Renewed",
  [WebhookEvent.SUBSCRIPTION_UPGRADED]: "Subscription Upgraded",
  [WebhookEvent.SUBSCRIPTION_DOWNGRADED]: "Subscription Downgraded",
  [WebhookEvent.SUBSCRIPTION_PAUSED]: "Subscription Paused",
  [WebhookEvent.SUBSCRIPTION_RESUMED]: "Subscription Resumed",
  [WebhookEvent.SUBSCRIPTION_CANCELLED]: "Subscription Cancelled",
  [WebhookEvent.SUBSCRIPTION_EXPIRED]: "Subscription Expired",
  [WebhookEvent.PAYMENT_FAILED]: "Payment Failed",
  [WebhookEvent.SUBSCRIPTION_PAYMENT_FAILED]: "Subscription Payment Failed",
  [WebhookEvent.COUPON_REDEEMED]: "Coupon Redeemed",
};

const FormSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.nativeEnum(WebhookEvent)).min(1, "Select at least one event"),
});
type FormValues = z.infer<typeof FormSchema>;

function formatTimestamp(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// DeliveryLogsModal
// ---------------------------------------------------------------------------

function DeliveryLogsModal({
  webhookId,
  webhookUrl,
  open,
  onClose,
}: {
  webhookId: string;
  webhookUrl: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useWebhookDeliveries(open ? webhookId : null);
  const retryDelivery = useRetryDelivery();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const deliveries: WebhookDelivery[] = data?.data ?? [];

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <Modal open={open} onClose={onClose} title="Delivery Logs" size="2xl">
      <p className="text-xs text-gray-500 mb-4 truncate" title={webhookUrl}>
        {webhookUrl}
      </p>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {!isLoading && deliveries.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          No deliveries recorded yet.
        </p>
      )}

      {!isLoading && deliveries.length > 0 && (
        <div className="max-h-[28rem] overflow-y-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200">
                <th className="pr-2 py-2 text-left font-medium text-gray-500 w-6" />
                <th className="px-2 py-2 text-left font-medium text-gray-500">Event</th>
                <th className="px-2 py-2 text-left font-medium text-gray-500">Timestamp</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500">Status</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500">Result</th>
                <th className="px-2 py-2 text-right font-medium text-gray-500">Duration</th>
                <th className="px-2 py-2 text-right font-medium text-gray-500 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deliveries.map((d) => (
                <DeliveryRow
                  key={d.id}
                  delivery={d}
                  webhookId={webhookId}
                  expanded={expandedId === d.id}
                  onToggle={() => toggleExpand(d.id)}
                  onRetry={() =>
                    retryDelivery.mutate({ webhookId, deliveryId: d.id })
                  }
                  retrying={retryDelivery.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function DeliveryRow({
  delivery,
  webhookId,
  expanded,
  onToggle,
  onRetry,
  retrying,
}: {
  delivery: WebhookDelivery;
  webhookId: string;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const d = delivery;

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="pr-2 py-2 text-gray-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-2 py-2">
          <Badge variant="info" size="sm">
            {WEBHOOK_EVENT_LABELS[d.event] ?? d.event}
          </Badge>
        </td>
        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
          {formatTimestamp(d.deliveredAt)}
        </td>
        <td className="px-2 py-2 text-center">
          {d.responseStatus != null ? (
            <span
              className={`font-mono text-xs font-medium ${
                d.responseStatus >= 200 && d.responseStatus < 300
                  ? "text-green-700"
                  : "text-red-600"
              }`}
            >
              {d.responseStatus}
            </span>
          ) : (
            <span className="text-xs text-gray-400">--</span>
          )}
        </td>
        <td className="px-2 py-2 text-center">
          {d.success ? (
            <Badge variant="success" size="sm">
              Success
            </Badge>
          ) : (
            <Badge variant="danger" size="sm">
              Failed
            </Badge>
          )}
        </td>
        <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">
          {d.durationMs != null ? `${d.durationMs}ms` : "--"}
        </td>
        <td className="px-2 py-2 text-right">
          {!d.success && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCw className="h-3.5 w-3.5" />}
              loading={retrying}
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
            >
              Retry
            </Button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="px-2 py-3 bg-gray-50">
            <div className="space-y-3">
              {/* Request payload */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Request Payload
                </p>
                <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-3 overflow-x-auto max-h-48">
                  {formatJson(d.requestBody)}
                </pre>
              </div>

              {/* Response body */}
              {d.responseBody != null && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Response Body
                  </p>
                  <pre className="bg-gray-900 text-amber-300 text-xs rounded-lg p-3 overflow-x-auto max-h-48">
                    {formatJson(d.responseBody)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {d.error && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Error
                  </p>
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">
                    {d.error}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// WebhookForm (unchanged)
// ---------------------------------------------------------------------------

function WebhookForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const createWebhook = useCreateWebhook();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      url: "",
      events: [],
    },
  });

  const selectedEvents = watch("events");

  function toggleEvent(event: WebhookEvent) {
    const current = selectedEvents ?? [];
    if (current.includes(event)) {
      setValue("events", current.filter((e) => e !== event), { shouldValidate: true });
    } else {
      setValue("events", [...current, event], { shouldValidate: true });
    }
  }

  function onSubmit(values: FormValues) {
    createWebhook.mutate(values as unknown as Record<string, unknown>, { onSuccess });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Webhook URL"
        type="url"
        required
        placeholder="https://example.com/webhook"
        error={errors.url?.message}
        {...register("url")}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
        {typeof errors.events?.message === "string" && (
          <p className="text-xs text-red-600 mb-2">{errors.events.message}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WEBHOOK_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={(selectedEvents ?? []).includes(event)}
                onChange={() => toggleEvent(event)}
              />
              {WEBHOOK_EVENT_LABELS[event] ?? event}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting || createWebhook.isPending}>
          Add Webhook
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// WebhookListPage
// ---------------------------------------------------------------------------

export function WebhookListPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [logsWebhook, setLogsWebhook] = useState<{ id: string; url: string } | null>(null);

  const { data, isLoading } = useWebhooks();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();

  const webhooks = data?.data ?? [];

  function handleDelete(id: string) {
    if (window.confirm("Delete this webhook? This cannot be undone.")) {
      deleteWebhook.mutate(id);
    }
  }

  function handleToggleActive(id: string, currentlyActive: boolean) {
    updateWebhook.mutate({ id, isActive: !currentlyActive });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Webhooks"
        subtitle="Manage webhook endpoints for event notifications"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>
            Add Webhook
          </Button>
        }
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && webhooks.length === 0 && (
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="No webhooks configured"
          description="Add a webhook endpoint to receive event notifications."
          action={{ label: "Add Webhook", onClick: () => setCreateModalOpen(true) }}
        />
      )}

      {/* Table */}
      {!isLoading && webhooks.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">URL</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Events</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Failures</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {webhooks.map((wh) => (
                <tr key={wh.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-xs" title={wh.url}>
                      {wh.url}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {wh.events.slice(0, 3).map((event) => (
                        <Badge key={event} variant="info" size="sm">
                          {WEBHOOK_EVENT_LABELS[event] ?? event}
                        </Badge>
                      ))}
                      {wh.events.length > 3 && (
                        <Badge variant="gray" size="sm">
                          +{wh.events.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(wh.id, wh.isActive)}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors cursor-pointer ${
                        wh.isActive
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${wh.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                      {wh.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {wh.failureCount > 0 ? (
                      <Badge variant="danger" size="sm">{wh.failureCount}</Badge>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ScrollText className="h-4 w-4" />}
                        onClick={() => setLogsWebhook({ id: wh.id, url: wh.url })}
                      >
                        Logs
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Zap className="h-4 w-4" />}
                        loading={testWebhook.isPending}
                        onClick={() => testWebhook.mutate(wh.id)}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4 text-red-500" />}
                        onClick={() => handleDelete(wh.id)}
                        loading={deleteWebhook.isPending}
                      >
                        <span className="text-red-600">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Webhook Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Webhook"
        size="lg"
      >
        <WebhookForm
          onSuccess={() => setCreateModalOpen(false)}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      {/* Delivery Logs Modal */}
      {logsWebhook && (
        <DeliveryLogsModal
          webhookId={logsWebhook.id}
          webhookUrl={logsWebhook.url}
          open={!!logsWebhook}
          onClose={() => setLogsWebhook(null)}
        />
      )}
    </div>
  );
}

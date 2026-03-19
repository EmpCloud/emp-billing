import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPut } from "../client";
import type { Organization } from "@emp-billing/shared";

const SETTINGS_KEY = "settings";
const NUMBERING_KEY = "settings-numbering";
const EMAIL_TEMPLATES_KEY = "settings-email-templates";

export function useOrgSettings() {
  return useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: () => apiGet<Organization>("/settings"),
  });
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPut<Organization>("/settings", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETTINGS_KEY] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });
}

export function useNumberingConfig() {
  return useQuery({
    queryKey: [NUMBERING_KEY],
    queryFn: () =>
      apiGet<{
        invoicePrefix: string;
        invoiceNextNumber: number;
        quotePrefix: string;
        quoteNextNumber: number;
      }>("/settings/numbering"),
  });
}

export function useUpdateNumberingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPut("/settings/numbering", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NUMBERING_KEY] });
      toast.success("Numbering config saved");
    },
    onError: () => toast.error("Failed to save numbering config"),
  });
}

// ── Email Templates ─────────────────────────────────────────────────────────

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: [EMAIL_TEMPLATES_KEY],
    queryFn: () =>
      apiGet<EmailTemplate[]>("/settings/email-templates"),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, ...data }: { name: string; subject?: string; body?: string }) =>
      apiPut<EmailTemplate>(`/settings/email-templates/${name}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EMAIL_TEMPLATES_KEY] });
      toast.success("Email template saved");
    },
    onError: () => toast.error("Failed to save email template"),
  });
}

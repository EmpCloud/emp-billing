import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import { RecurringFrequency, RecurringStatus } from "@emp-billing/shared";
import type { RecurringProfile } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateRecurringProfileSchema, UpdateRecurringProfileSchema } from "@emp-billing/shared";

// ============================================================================
// RECURRING PROFILE SERVICE
// ============================================================================

// ── Compute next date ────────────────────────────────────────────────────────

export function computeNextDate(
  currentDate: Date | string,
  frequency: RecurringFrequency,
  customDays?: number
): Date {
  const d = dayjs(currentDate);

  switch (frequency) {
    case RecurringFrequency.DAILY:
      return d.add(1, "day").toDate();
    case RecurringFrequency.WEEKLY:
      return d.add(1, "week").toDate();
    case RecurringFrequency.MONTHLY:
      return d.add(1, "month").toDate();
    case RecurringFrequency.QUARTERLY:
      return d.add(3, "month").toDate();
    case RecurringFrequency.HALF_YEARLY:
      return d.add(6, "month").toDate();
    case RecurringFrequency.YEARLY:
      return d.add(1, "year").toDate();
    case RecurringFrequency.CUSTOM:
      if (!customDays || customDays <= 0) {
        throw BadRequestError("customDays is required for custom frequency");
      }
      return d.add(customDays, "day").toDate();
    default:
      throw BadRequestError(`Unknown frequency: ${frequency}`);
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listProfiles(
  orgId: string,
  opts: { page?: number; limit?: number; status?: string; clientId?: string }
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.status) where.status = opts.status;
  if (opts.clientId) where.client_id = opts.clientId;

  const result = await db.findPaginated<RecurringProfile>("recurring_profiles", {
    where,
    page: opts.page ?? 1,
    limit: opts.limit ?? 20,
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return result;
}

// ── Get ───────────────────────────────────────────────────────────────────────

export async function getProfile(orgId: string, id: string): Promise<RecurringProfile> {
  const db = await getDB();
  const profile = await db.findById<RecurringProfile>("recurring_profiles", id, orgId);
  if (!profile) throw NotFoundError("RecurringProfile");
  return profile;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createProfile(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateRecurringProfileSchema>
): Promise<RecurringProfile> {
  const db = await getDB();

  // Validate client exists
  const client = await db.findById<{ id: string }>("clients", input.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  const id = uuid();
  const now = new Date();
  const nextExecutionDate = computeNextDate(input.startDate, input.frequency, input.customDays);

  await db.create("recurring_profiles", {
    id,
    orgId,
    clientId: input.clientId,
    type: input.type,
    frequency: input.frequency,
    customDays: input.customDays ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    maxOccurrences: input.maxOccurrences ?? null,
    occurrenceCount: 0,
    nextExecutionDate,
    status: RecurringStatus.ACTIVE,
    autoSend: input.autoSend ?? false,
    autoCharge: input.autoCharge ?? false,
    templateData: JSON.stringify(input.templateData),
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  return getProfile(orgId, id);
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateProfile(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateRecurringProfileSchema>
): Promise<RecurringProfile> {
  const db = await getDB();
  const existing = await db.findById<RecurringProfile>("recurring_profiles", id, orgId);
  if (!existing) throw NotFoundError("RecurringProfile");

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.clientId !== undefined) updateData.clientId = input.clientId;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.frequency !== undefined) updateData.frequency = input.frequency;
  if (input.customDays !== undefined) updateData.customDays = input.customDays;
  if (input.startDate !== undefined) updateData.startDate = input.startDate;
  if (input.endDate !== undefined) updateData.endDate = input.endDate;
  if (input.maxOccurrences !== undefined) updateData.maxOccurrences = input.maxOccurrences;
  if (input.autoSend !== undefined) updateData.autoSend = input.autoSend;
  if (input.autoCharge !== undefined) updateData.autoCharge = input.autoCharge;
  if (input.templateData !== undefined) updateData.templateData = JSON.stringify(input.templateData);

  // Recompute nextExecutionDate if frequency or startDate changed
  const newFrequency = input.frequency ?? existing.frequency;
  const newCustomDays = input.customDays ?? existing.customDays;
  if (input.frequency !== undefined || input.startDate !== undefined) {
    const baseDate = input.startDate ?? existing.startDate;
    updateData.nextExecutionDate = computeNextDate(baseDate, newFrequency, newCustomDays);
  }

  await db.update("recurring_profiles", id, updateData, orgId);
  return getProfile(orgId, id);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteProfile(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const profile = await db.findById<RecurringProfile>("recurring_profiles", id, orgId);
  if (!profile) throw NotFoundError("RecurringProfile");

  if (![RecurringStatus.ACTIVE, RecurringStatus.PAUSED].includes(profile.status)) {
    throw BadRequestError("Only active or paused profiles can be deleted");
  }

  await db.delete("recurring_profiles", id, orgId);
}

// ── Pause ─────────────────────────────────────────────────────────────────────

export async function pauseProfile(orgId: string, id: string): Promise<RecurringProfile> {
  const db = await getDB();
  const profile = await db.findById<RecurringProfile>("recurring_profiles", id, orgId);
  if (!profile) throw NotFoundError("RecurringProfile");

  if (profile.status !== RecurringStatus.ACTIVE) {
    throw BadRequestError("Only active profiles can be paused");
  }

  await db.update("recurring_profiles", id, {
    status: RecurringStatus.PAUSED,
    updatedAt: new Date(),
  }, orgId);

  return getProfile(orgId, id);
}

// ── Resume ────────────────────────────────────────────────────────────────────

export async function resumeProfile(orgId: string, id: string): Promise<RecurringProfile> {
  const db = await getDB();
  const profile = await db.findById<RecurringProfile>("recurring_profiles", id, orgId);
  if (!profile) throw NotFoundError("RecurringProfile");

  if (profile.status !== RecurringStatus.PAUSED) {
    throw BadRequestError("Only paused profiles can be resumed");
  }

  const now = new Date();
  const nextExecutionDate = computeNextDate(now, profile.frequency, profile.customDays);

  await db.update("recurring_profiles", id, {
    status: RecurringStatus.ACTIVE,
    nextExecutionDate,
    updatedAt: now,
  }, orgId);

  return getProfile(orgId, id);
}

// ── Executions ────────────────────────────────────────────────────────────────

export async function getExecutions(orgId: string, profileId: string) {
  const db = await getDB();

  // Validate profile exists
  const profile = await db.findById<RecurringProfile>("recurring_profiles", profileId, orgId);
  if (!profile) throw NotFoundError("RecurringProfile");

  const executions = await db.findMany("recurring_executions", {
    where: { profile_id: profileId, org_id: orgId },
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return executions;
}

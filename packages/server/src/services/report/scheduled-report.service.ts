import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import type { ScheduledReport, ScheduledReportFrequency } from "@emp-billing/shared";

// ============================================================================
// SCHEDULED REPORT SERVICE
// ============================================================================

// ── Compute next send time ──────────────────────────────────────────────────

export function computeNextSendAt(
  frequency: ScheduledReportFrequency,
  fromDate?: Date,
): Date {
  const base = fromDate ? dayjs(fromDate) : dayjs();

  switch (frequency) {
    case "daily":
      // Next day at 8:00 AM UTC
      return base.add(1, "day").hour(8).minute(0).second(0).millisecond(0).toDate();

    case "weekly":
      // Next Monday at 8:00 AM UTC
      // dayjs().day() returns 0=Sunday, 1=Monday, ..., 6=Saturday
      {
        let nextMonday = base.add(1, "day");
        while (nextMonday.day() !== 1) {
          nextMonday = nextMonday.add(1, "day");
        }
        return nextMonday.hour(8).minute(0).second(0).millisecond(0).toDate();
      }

    case "monthly":
      // 1st of next month at 8:00 AM UTC
      return base
        .add(1, "month")
        .date(1)
        .hour(8)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate();

    default:
      return base.add(1, "day").hour(8).minute(0).second(0).millisecond(0).toDate();
  }
}

// ── List scheduled reports for an org ───────────────────────────────────────

export async function listScheduledReports(
  orgId: string,
): Promise<ScheduledReport[]> {
  const db = await getDB();
  const rows = await db.findMany<ScheduledReport>("scheduled_reports", {
    where: { org_id: orgId },
  });
  return rows;
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createScheduledReport(
  orgId: string,
  userId: string,
  data: {
    reportType: string;
    frequency: ScheduledReportFrequency;
    recipientEmail: string;
    isActive?: boolean;
  },
): Promise<ScheduledReport> {
  const db = await getDB();
  const now = new Date();
  const id = uuid();

  const nextSendAt = computeNextSendAt(data.frequency);

  const record = {
    id,
    orgId,
    reportType: data.reportType,
    frequency: data.frequency,
    recipientEmail: data.recipientEmail,
    isActive: data.isActive ?? true,
    lastSentAt: null,
    nextSendAt,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await db.create("scheduled_reports", record);
  return record as unknown as ScheduledReport;
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateScheduledReport(
  orgId: string,
  id: string,
  data: {
    reportType?: string;
    frequency?: ScheduledReportFrequency;
    recipientEmail?: string;
    isActive?: boolean;
  },
): Promise<ScheduledReport> {
  const db = await getDB();
  const now = new Date();

  const updates: Record<string, unknown> = {
    ...data,
    updatedAt: now,
  };

  // If frequency changed, recompute next_send_at
  if (data.frequency) {
    updates.nextSendAt = computeNextSendAt(data.frequency);
  }

  await db.update("scheduled_reports", id, updates, orgId);

  const updated = await db.findById<ScheduledReport>("scheduled_reports", id, orgId);
  return updated!;
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function deleteScheduledReport(
  orgId: string,
  id: string,
): Promise<void> {
  const db = await getDB();
  await db.delete("scheduled_reports", id, orgId);
}

// ── Get due reports ─────────────────────────────────────────────────────────

export async function getDueReports(): Promise<ScheduledReport[]> {
  const db = await getDB();
  const now = new Date();

  const rows = await db.raw<ScheduledReport[]>(
    `SELECT * FROM scheduled_reports
     WHERE is_active = true AND next_send_at <= ?
     ORDER BY next_send_at ASC`,
    [now],
  );

  return rows;
}

// ── Mark report as sent ─────────────────────────────────────────────────────

export async function markReportSent(
  report: ScheduledReport,
): Promise<void> {
  const db = await getDB();
  const now = new Date();
  const nextSendAt = computeNextSendAt(report.frequency as ScheduledReportFrequency, now);

  await db.update(
    "scheduled_reports",
    report.id,
    {
      lastSentAt: now,
      nextSendAt,
      updatedAt: now,
    },
    report.orgId,
  );
}

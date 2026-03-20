"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNextDate = computeNextDate;
exports.listProfiles = listProfiles;
exports.getProfile = getProfile;
exports.createProfile = createProfile;
exports.updateProfile = updateProfile;
exports.deleteProfile = deleteProfile;
exports.pauseProfile = pauseProfile;
exports.resumeProfile = resumeProfile;
exports.getExecutions = getExecutions;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
// ============================================================================
// RECURRING PROFILE SERVICE
// ============================================================================
// ── Compute next date ────────────────────────────────────────────────────────
function computeNextDate(currentDate, frequency, customDays) {
    const d = (0, dayjs_1.default)(currentDate);
    switch (frequency) {
        case shared_1.RecurringFrequency.DAILY:
            return d.add(1, "day").toDate();
        case shared_1.RecurringFrequency.WEEKLY:
            return d.add(1, "week").toDate();
        case shared_1.RecurringFrequency.MONTHLY:
            return d.add(1, "month").toDate();
        case shared_1.RecurringFrequency.QUARTERLY:
            return d.add(3, "month").toDate();
        case shared_1.RecurringFrequency.HALF_YEARLY:
            return d.add(6, "month").toDate();
        case shared_1.RecurringFrequency.YEARLY:
            return d.add(1, "year").toDate();
        case shared_1.RecurringFrequency.CUSTOM:
            if (!customDays || customDays <= 0) {
                throw (0, AppError_1.BadRequestError)("customDays is required for custom frequency");
            }
            return d.add(customDays, "day").toDate();
        default:
            throw (0, AppError_1.BadRequestError)(`Unknown frequency: ${frequency}`);
    }
}
// ── List ─────────────────────────────────────────────────────────────────────
async function listProfiles(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.status)
        where.status = opts.status;
    if (opts.clientId)
        where.client_id = opts.clientId;
    const result = await db.findPaginated("recurring_profiles", {
        where,
        page: opts.page ?? 1,
        limit: opts.limit ?? 20,
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    return result;
}
// ── Get ───────────────────────────────────────────────────────────────────────
async function getProfile(orgId, id) {
    const db = await (0, index_1.getDB)();
    const profile = await db.findById("recurring_profiles", id, orgId);
    if (!profile)
        throw (0, AppError_1.NotFoundError)("RecurringProfile");
    return profile;
}
// ── Create ────────────────────────────────────────────────────────────────────
async function createProfile(orgId, userId, input) {
    const db = await (0, index_1.getDB)();
    // Validate client exists
    const client = await db.findById("clients", input.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    const id = (0, uuid_1.v4)();
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
        status: shared_1.RecurringStatus.ACTIVE,
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
async function updateProfile(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("recurring_profiles", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("RecurringProfile");
    const now = new Date();
    const updateData = { updatedAt: now };
    if (input.clientId !== undefined)
        updateData.clientId = input.clientId;
    if (input.type !== undefined)
        updateData.type = input.type;
    if (input.frequency !== undefined)
        updateData.frequency = input.frequency;
    if (input.customDays !== undefined)
        updateData.customDays = input.customDays;
    if (input.startDate !== undefined)
        updateData.startDate = input.startDate;
    if (input.endDate !== undefined)
        updateData.endDate = input.endDate;
    if (input.maxOccurrences !== undefined)
        updateData.maxOccurrences = input.maxOccurrences;
    if (input.autoSend !== undefined)
        updateData.autoSend = input.autoSend;
    if (input.autoCharge !== undefined)
        updateData.autoCharge = input.autoCharge;
    if (input.templateData !== undefined)
        updateData.templateData = JSON.stringify(input.templateData);
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
async function deleteProfile(orgId, id) {
    const db = await (0, index_1.getDB)();
    const profile = await db.findById("recurring_profiles", id, orgId);
    if (!profile)
        throw (0, AppError_1.NotFoundError)("RecurringProfile");
    if (![shared_1.RecurringStatus.ACTIVE, shared_1.RecurringStatus.PAUSED].includes(profile.status)) {
        throw (0, AppError_1.BadRequestError)("Only active or paused profiles can be deleted");
    }
    await db.delete("recurring_profiles", id, orgId);
}
// ── Pause ─────────────────────────────────────────────────────────────────────
async function pauseProfile(orgId, id) {
    const db = await (0, index_1.getDB)();
    const profile = await db.findById("recurring_profiles", id, orgId);
    if (!profile)
        throw (0, AppError_1.NotFoundError)("RecurringProfile");
    if (profile.status !== shared_1.RecurringStatus.ACTIVE) {
        throw (0, AppError_1.BadRequestError)("Only active profiles can be paused");
    }
    await db.update("recurring_profiles", id, {
        status: shared_1.RecurringStatus.PAUSED,
        updatedAt: new Date(),
    }, orgId);
    return getProfile(orgId, id);
}
// ── Resume ────────────────────────────────────────────────────────────────────
async function resumeProfile(orgId, id) {
    const db = await (0, index_1.getDB)();
    const profile = await db.findById("recurring_profiles", id, orgId);
    if (!profile)
        throw (0, AppError_1.NotFoundError)("RecurringProfile");
    if (profile.status !== shared_1.RecurringStatus.PAUSED) {
        throw (0, AppError_1.BadRequestError)("Only paused profiles can be resumed");
    }
    const now = new Date();
    const nextExecutionDate = computeNextDate(now, profile.frequency, profile.customDays);
    await db.update("recurring_profiles", id, {
        status: shared_1.RecurringStatus.ACTIVE,
        nextExecutionDate,
        updatedAt: now,
    }, orgId);
    return getProfile(orgId, id);
}
// ── Executions ────────────────────────────────────────────────────────────────
async function getExecutions(orgId, profileId) {
    const db = await (0, index_1.getDB)();
    // Validate profile exists
    const profile = await db.findById("recurring_profiles", profileId, orgId);
    if (!profile)
        throw (0, AppError_1.NotFoundError)("RecurringProfile");
    const executions = await db.findMany("recurring_executions", {
        where: { profile_id: profileId, org_id: orgId },
        orderBy: [{ column: "executed_at", direction: "desc" }],
    });
    return executions;
}
//# sourceMappingURL=recurring.service.js.map
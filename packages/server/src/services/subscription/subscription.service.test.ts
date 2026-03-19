import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));
vi.mock("../../events/index", () => ({ emit: vi.fn() }));
vi.mock("../../utils/number-generator", () => ({
  nextInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0001"),
}));

import { getDB } from "../../db/adapters/index";
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  listSubscriptions,
  createSubscription,
  cancelSubscription,
} from "./subscription.service";
import { BillingInterval, SubscriptionStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return {
    findMany: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findPaginated: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
    update: vi.fn().mockImplementation((_t: string, _id: string, data: Record<string, unknown>) => data),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  };
}

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    orgId: ORG_ID,
    name: "Basic",
    description: "Basic plan",
    billingInterval: BillingInterval.MONTHLY,
    billingIntervalDays: null,
    trialPeriodDays: 0,
    price: 10000,
    setupFee: 0,
    currency: "INR",
    features: "[]",
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("subscription.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── Plans ───────────────────────────────────────────────────────────────

  describe("listPlans", () => {
    it("returns active plans with parsed features", async () => {
      mockDb.findMany.mockResolvedValue([makePlan({ features: '["feature1"]' })]);

      const result = await listPlans(ORG_ID);

      expect(result).toHaveLength(1);
      expect(result[0].features).toEqual(["feature1"]);
    });
  });

  describe("getPlan", () => {
    it("returns plan by id", async () => {
      mockDb.findById.mockResolvedValue(makePlan());
      const result = await getPlan(ORG_ID, "plan-1");
      expect(result.name).toBe("Basic");
    });

    it("throws NotFoundError when plan does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(getPlan(ORG_ID, "missing")).rejects.toThrow("Plan");
    });
  });

  describe("createPlan", () => {
    it("creates a plan", async () => {
      mockDb.findById.mockResolvedValue(makePlan());

      const result = await createPlan(ORG_ID, {
        name: "Pro",
        billingInterval: BillingInterval.MONTHLY,
        price: 20000,
      });

      expect(mockDb.create).toHaveBeenCalledWith("plans", expect.objectContaining({
        name: "Pro",
        price: 20000,
      }));
    });
  });

  describe("updatePlan", () => {
    it("updates plan fields", async () => {
      mockDb.findById.mockResolvedValue(makePlan());

      await updatePlan(ORG_ID, "plan-1", { name: "Premium" });

      expect(mockDb.update).toHaveBeenCalledWith("plans", "plan-1", expect.objectContaining({
        name: "Premium",
      }), ORG_ID);
    });

    it("throws NotFoundError when plan does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(updatePlan(ORG_ID, "missing", { name: "x" })).rejects.toThrow("Plan");
    });
  });

  describe("deletePlan", () => {
    it("soft-deletes a plan", async () => {
      mockDb.findById.mockResolvedValue(makePlan());

      await deletePlan(ORG_ID, "plan-1");

      expect(mockDb.update).toHaveBeenCalledWith("plans", "plan-1", expect.objectContaining({
        isActive: false,
      }), ORG_ID);
    });

    it("throws NotFoundError when plan does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(deletePlan(ORG_ID, "missing")).rejects.toThrow("Plan");
    });
  });

  // ── Subscriptions ──────────────────────────────────────────────────────

  describe("listSubscriptions", () => {
    it("returns paginated subscriptions", async () => {
      mockDb.findPaginated.mockResolvedValue({
        data: [{ id: "sub-1" }],
        total: 1, page: 1, limit: 20, totalPages: 1,
      });

      const result = await listSubscriptions(ORG_ID, { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe("createSubscription", () => {
    it("creates subscription with trial period", async () => {
      // createSubscription checks client first, then plan (via getPlan which uses findById)
      mockDb.findById.mockResolvedValueOnce({ id: "cli-1" }); // client
      mockDb.findById.mockResolvedValueOnce(makePlan({ trialPeriodDays: 14 })); // plan (getPlan)
      // After creation: getSubscription calls findById for sub, then getPlan for plan, then findMany for events
      const createdSub = {
        id: "sub-new",
        orgId: ORG_ID,
        clientId: "cli-1",
        planId: "plan-1",
        status: SubscriptionStatus.TRIALING,
      };
      mockDb.findById.mockResolvedValueOnce(createdSub); // getSubscription -> findById sub
      mockDb.findById.mockResolvedValueOnce(makePlan({ trialPeriodDays: 14 })); // getSubscription -> getPlan
      mockDb.findMany.mockResolvedValueOnce([]); // getSubscription -> findMany events

      const result = await createSubscription(ORG_ID, "usr-1", {
        planId: "plan-1",
        clientId: "cli-1",
        quantity: 1,
      });

      expect(result.status).toBe(SubscriptionStatus.TRIALING);
      expect(mockDb.create).toHaveBeenCalledWith("subscriptions", expect.objectContaining({
        planId: "plan-1",
        status: SubscriptionStatus.TRIALING,
      }));
    });

    it("creates active subscription with no trial", async () => {
      mockDb.findById.mockResolvedValueOnce({ id: "cli-1" }); // client
      mockDb.findById.mockResolvedValueOnce(makePlan({ trialPeriodDays: 0 })); // plan
      // getSubscription chain
      mockDb.findById.mockResolvedValueOnce({
        id: "sub-new",
        orgId: ORG_ID,
        clientId: "cli-1",
        planId: "plan-1",
        status: SubscriptionStatus.ACTIVE,
      });
      mockDb.findById.mockResolvedValueOnce(makePlan({ trialPeriodDays: 0 }));
      mockDb.findMany.mockResolvedValueOnce([]);

      const result = await createSubscription(ORG_ID, "usr-1", {
        planId: "plan-1",
        clientId: "cli-1",
        quantity: 1,
      });

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it("throws when client not found", async () => {
      mockDb.findById.mockResolvedValueOnce(null); // client not found

      await expect(
        createSubscription(ORG_ID, "usr-1", {
          planId: "plan-1",
          clientId: "missing",
          quantity: 1,
        })
      ).rejects.toThrow("Client");
    });
  });

  describe("cancelSubscription", () => {
    it("cancels immediately", async () => {
      const sub = {
        id: "sub-1",
        orgId: ORG_ID,
        status: SubscriptionStatus.ACTIVE,
        planId: "plan-1",
        clientId: "cli-1",
      };
      mockDb.findById.mockResolvedValueOnce(sub); // first findById for cancel
      mockDb.findById.mockResolvedValueOnce(sub); // final findById at end of cancel

      await cancelSubscription(ORG_ID, "sub-1", { cancelImmediately: true });

      expect(mockDb.update).toHaveBeenCalledWith("subscriptions", "sub-1", expect.objectContaining({
        status: SubscriptionStatus.CANCELLED,
      }), ORG_ID);
    });

    it("sets autoRenew=false when not cancelling immediately", async () => {
      const sub = {
        id: "sub-1",
        orgId: ORG_ID,
        status: SubscriptionStatus.ACTIVE,
        planId: "plan-1",
        clientId: "cli-1",
      };
      mockDb.findById.mockResolvedValueOnce(sub);
      mockDb.findById.mockResolvedValueOnce(sub);

      await cancelSubscription(ORG_ID, "sub-1", { cancelImmediately: false });

      expect(mockDb.update).toHaveBeenCalledWith("subscriptions", "sub-1", expect.objectContaining({
        autoRenew: false,
      }), ORG_ID);
    });

    it("throws when subscription not found", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        cancelSubscription(ORG_ID, "missing", { cancelImmediately: false })
      ).rejects.toThrow("Subscription");
    });
  });
});

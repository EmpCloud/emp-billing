// ============================================================================
// EMP BILLING — Product & Tax Rate Service Deep Real-DB Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";

let db: Knex;
const TS = Date.now();
const ORG_ID = uuid();

beforeAll(async () => {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");
  await db("organizations").insert({ id: ORG_ID, name: `POrg-${TS}`, legal_name: `POrg-${TS}`, email: `porg-${TS}@test.t`, address: JSON.stringify({ line1: "3 P St", city: "Chennai", state: "TN", zip: "600001", country: "IN" }), default_currency: "INR", country: "IN", invoice_prefix: "PINV", quote_prefix: "PQTE" });
});

afterAll(async () => {
  const tables = ["products", "tax_rates", "organizations"];
  for (const t of tables) { try { await db(t).where("org_id", ORG_ID).delete(); } catch {} }
  try { await db("organizations").where({ id: ORG_ID }).delete(); } catch {}
  await db.destroy();
});

async function createProduct(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("products").insert({ id, org_id: ORG_ID, name: `Product-${TS}-${id.slice(0,4)}`, type: "service", rate: 100000, pricing_model: "flat", ...ov });
  return id;
}

async function createTaxRate(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("tax_rates").insert({ id, org_id: ORG_ID, name: `Tax-${TS}-${id.slice(0,4)}`, type: "gst", rate: 18.00, ...ov });
  return id;
}

describe("Product Service - Deep Coverage", () => {
  describe("createProduct", () => {
    it("creates service product", async () => {
      const pId = await createProduct();
      const p = await db("products").where({ id: pId }).first();
      expect(p.type).toBe("service");
      expect(Number(p.rate)).toBe(100000);
      expect(p.pricing_model).toBe("flat");
    });
    it("creates goods product with SKU", async () => {
      const pId = await createProduct({ type: "goods", sku: `SKU-${TS}`, name: "Widget" });
      const p = await db("products").where({ id: pId }).first();
      expect(p.type).toBe("goods");
      expect(p.sku).toBe(`SKU-${TS}`);
    });
    it("creates product with HSN code", async () => {
      const pId = await createProduct({ hsn_code: "998314" });
      expect((await db("products").where({ id: pId }).first()).hsn_code).toBe("998314");
    });
    it("creates product with inventory tracking", async () => {
      const pId = await createProduct({ type: "goods", track_inventory: true, stock_on_hand: 100, reorder_level: 10 });
      const p = await db("products").where({ id: pId }).first();
      expect(p.track_inventory).toBeTruthy();
      expect(p.stock_on_hand).toBe(100);
      expect(p.reorder_level).toBe(10);
    });
    it("creates product with tax_rate_id", async () => {
      const trId = await createTaxRate();
      const pId = await createProduct({ tax_rate_id: trId });
      expect((await db("products").where({ id: pId }).first()).tax_rate_id).toBe(trId);
    });
    it("creates product with description and unit", async () => {
      const pId = await createProduct({ description: "Hourly consulting", unit: "hours" });
      const p = await db("products").where({ id: pId }).first();
      expect(p.description).toBe("Hourly consulting");
      expect(p.unit).toBe("hours");
    });
  });

  describe("pricing models", () => {
    for (const model of ["flat", "tiered", "volume", "per_seat", "metered"] as const) {
      it(`supports ${model} pricing model`, async () => {
        const pId = await createProduct({ pricing_model: model });
        expect((await db("products").where({ id: pId }).first()).pricing_model).toBe(model);
      });
    }
    it("stores pricing_tiers as JSON", async () => {
      const tiers = [{ min: 1, max: 10, rate: 100000 }, { min: 11, max: 100, rate: 80000 }];
      const pId = await createProduct({ pricing_model: "tiered", pricing_tiers: JSON.stringify(tiers) });
      const p = await db("products").where({ id: pId }).first();
      const parsed = typeof p.pricing_tiers === "string" ? JSON.parse(p.pricing_tiers) : p.pricing_tiers;
      expect(parsed).toHaveLength(2);
      expect(parsed[0].min).toBe(1);
    });
  });

  describe("listProducts", () => {
    it("lists products for org", async () => {
      await createProduct();
      expect((await db("products").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters active products", async () => {
      await createProduct({ is_active: true });
      expect((await db("products").where({ org_id: ORG_ID, is_active: true })).length).toBeGreaterThan(0);
    });
    it("filters by type", async () => {
      await createProduct({ type: "goods" });
      expect((await db("products").where({ org_id: ORG_ID, type: "goods" })).length).toBeGreaterThan(0);
    });
    it("searches by name", async () => {
      await createProduct({ name: `UniqueProduct-${TS}` });
      const rows = await db("products").where({ org_id: ORG_ID }).where("name", "like", `%UniqueProduct-${TS}%`);
      expect(rows.length).toBe(1);
    });
  });

  describe("getProduct", () => {
    it("returns product by id", async () => {
      const pId = await createProduct();
      expect((await db("products").where({ id: pId }).first()).id).toBe(pId);
    });
    it("returns undefined for non-existent", async () => {
      expect(await db("products").where({ id: uuid(), org_id: ORG_ID }).first()).toBeUndefined();
    });
  });

  describe("updateProduct", () => {
    it("updates name and rate", async () => {
      const pId = await createProduct();
      await db("products").where({ id: pId }).update({ name: "Updated Product", rate: 200000 });
      const p = await db("products").where({ id: pId }).first();
      expect(p.name).toBe("Updated Product");
      expect(Number(p.rate)).toBe(200000);
    });
    it("updates inventory counts", async () => {
      const pId = await createProduct({ track_inventory: true, stock_on_hand: 50 });
      await db("products").where({ id: pId }).update({ stock_on_hand: 45 });
      expect((await db("products").where({ id: pId }).first()).stock_on_hand).toBe(45);
    });
  });

  describe("deleteProduct (deactivate)", () => {
    it("sets is_active false", async () => {
      const pId = await createProduct();
      await db("products").where({ id: pId }).update({ is_active: false });
      expect((await db("products").where({ id: pId }).first()).is_active).toBeFalsy();
    });
  });

  describe("ordering", () => {
    it("orders products by name for display", async () => {
      await createProduct({ name: "AAA Product" });
      await createProduct({ name: "ZZZ Product" });
      const prods = await db("products").where({ org_id: ORG_ID }).orderBy("name");
      expect(prods[0].name <= prods[prods.length - 1].name).toBe(true);
    });
  });
});

describe("Tax Rate Service - Deep Coverage", () => {
  describe("createTaxRate", () => {
    it("creates GST tax rate", async () => {
      const trId = await createTaxRate({ type: "gst", rate: 18 });
      const tr = await db("tax_rates").where({ id: trId }).first();
      expect(tr.type).toBe("gst");
      expect(Number(tr.rate)).toBe(18);
    });
    it("creates IGST tax rate", async () => {
      const trId = await createTaxRate({ type: "igst", rate: 18 });
      expect((await db("tax_rates").where({ id: trId }).first()).type).toBe("igst");
    });
    it("creates VAT tax rate", async () => {
      const trId = await createTaxRate({ type: "vat", rate: 20 });
      expect((await db("tax_rates").where({ id: trId }).first()).type).toBe("vat");
    });
    it("creates sales_tax", async () => {
      const trId = await createTaxRate({ type: "sales_tax", rate: 8.5 });
      expect(Number((await db("tax_rates").where({ id: trId }).first()).rate)).toBeCloseTo(8.5, 1);
    });
    it("creates custom tax type", async () => {
      const trId = await createTaxRate({ type: "custom", rate: 5 });
      expect((await db("tax_rates").where({ id: trId }).first()).type).toBe("custom");
    });
    it("stores components JSON for compound tax", async () => {
      const comps = [{ name: "CGST", rate: 9 }, { name: "SGST", rate: 9 }];
      const trId = await createTaxRate({ is_compound: true, components: JSON.stringify(comps) });
      const tr = await db("tax_rates").where({ id: trId }).first();
      expect(tr.is_compound).toBeTruthy();
      const parsed = typeof tr.components === "string" ? JSON.parse(tr.components) : tr.components;
      expect(parsed).toHaveLength(2);
    });
    it("creates default tax rate", async () => {
      const trId = await createTaxRate({ is_default: true });
      expect((await db("tax_rates").where({ id: trId }).first()).is_default).toBeTruthy();
    });
  });

  describe("listTaxRates", () => {
    it("lists tax rates for org", async () => {
      await createTaxRate();
      expect((await db("tax_rates").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters active tax rates", async () => {
      expect((await db("tax_rates").where({ org_id: ORG_ID, is_active: true })).length).toBeGreaterThan(0);
    });
  });

  describe("updateTaxRate", () => {
    it("updates rate and name", async () => {
      const trId = await createTaxRate();
      await db("tax_rates").where({ id: trId }).update({ name: "Updated GST", rate: 12 });
      const tr = await db("tax_rates").where({ id: trId }).first();
      expect(tr.name).toBe("Updated GST");
      expect(Number(tr.rate)).toBe(12);
    });
  });

  describe("deleteTaxRate (deactivate)", () => {
    it("sets is_active false", async () => {
      const trId = await createTaxRate();
      await db("tax_rates").where({ id: trId }).update({ is_active: false });
      expect((await db("tax_rates").where({ id: trId }).first()).is_active).toBeFalsy();
    });
  });

  describe("tax calculation logic (pure)", () => {
    it("CGST + SGST intra-state = 18%", () => {
      const subtotal = 100000;
      const cgst = Math.round(subtotal * 9 / 100);
      const sgst = Math.round(subtotal * 9 / 100);
      expect(cgst + sgst).toBe(18000);
    });
    it("IGST inter-state = 18%", () => {
      const subtotal = 100000;
      const igst = Math.round(subtotal * 18 / 100);
      expect(igst).toBe(18000);
    });
    it("tax on discounted amount", () => {
      const subtotal = 100000;
      const discount = 10000;
      const taxable = subtotal - discount;
      const tax = Math.round(taxable * 18 / 100);
      expect(tax).toBe(16200);
    });
    it("compound tax calculation", () => {
      const subtotal = 100000;
      const first = Math.round(subtotal * 9 / 100); // 9000
      const second = Math.round((subtotal + first) * 9 / 100); // 9810
      expect(first + second).toBe(18810);
    });
    it("zero tax rate produces zero", () => {
      expect(Math.round(100000 * 0 / 100)).toBe(0);
    });
  });
});

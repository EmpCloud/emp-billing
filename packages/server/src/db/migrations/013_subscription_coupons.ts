import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("subscriptions", (t) => {
    t.string("coupon_id", 36).nullable().comment("Applied coupon for recurring discount");
    t.integer("coupon_discount_amount").defaultTo(0).comment("Discount amount applied per billing cycle in paise");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("subscriptions", (t) => {
    t.dropColumn("coupon_id");
    t.dropColumn("coupon_discount_amount");
  });
}

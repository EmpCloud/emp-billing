import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("coupons", (t) => {
    t.integer("max_redemptions_per_client").nullable().comment("Max times a single client can redeem this coupon");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("coupons", (t) => {
    t.dropColumn("max_redemptions_per_client");
  });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable("coupons", (t) => {
        t.integer("max_redemptions_per_client").nullable().comment("Max times a single client can redeem this coupon");
    });
}
async function down(knex) {
    await knex.schema.alterTable("coupons", (t) => {
        t.dropColumn("max_redemptions_per_client");
    });
}
//# sourceMappingURL=014_coupon_per_client_limit.js.map
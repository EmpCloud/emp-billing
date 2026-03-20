"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable("subscriptions", (t) => {
        t.string("coupon_id", 36).nullable().comment("Applied coupon for recurring discount");
        t.integer("coupon_discount_amount").defaultTo(0).comment("Discount amount applied per billing cycle in paise");
    });
}
async function down(knex) {
    await knex.schema.alterTable("subscriptions", (t) => {
        t.dropColumn("coupon_id");
        t.dropColumn("coupon_discount_amount");
    });
}
//# sourceMappingURL=013_subscription_coupons.js.map
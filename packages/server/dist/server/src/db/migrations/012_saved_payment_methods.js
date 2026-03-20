"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 012 — Saved Payment Methods
// Adds payment method columns to the clients table so subscriptions can be
// auto-charged on renewal using a stored gateway token.
// ============================================================================
async function up(knex) {
    await knex.schema.alterTable("clients", (t) => {
        t.string("payment_gateway", 50).nullable().comment("e.g. stripe, razorpay");
        t.string("payment_method_id", 255).nullable().comment("Gateway-specific token / customer ID");
        t.string("payment_method_last4", 4).nullable().comment("Last 4 digits for display");
        t.string("payment_method_brand", 50).nullable().comment("Card brand (visa, mastercard, etc.)");
    });
}
async function down(knex) {
    await knex.schema.alterTable("clients", (t) => {
        t.dropColumn("payment_gateway");
        t.dropColumn("payment_method_id");
        t.dropColumn("payment_method_last4");
        t.dropColumn("payment_method_brand");
    });
}
//# sourceMappingURL=012_saved_payment_methods.js.map
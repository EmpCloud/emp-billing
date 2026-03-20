"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 004 — Notifications
// In-app notification center for billing events.
// ============================================================================
async function up(knex) {
    await knex.schema.createTable("notifications", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36)
            .notNullable()
            .references("id")
            .inTable("organizations")
            .onDelete("CASCADE");
        t.string("user_id", 36).nullable().references("id").inTable("users").onDelete("CASCADE");
        t.enum("type", [
            "invoice_created",
            "invoice_sent",
            "invoice_paid",
            "invoice_overdue",
            "payment_received",
            "quote_accepted",
            "quote_expired",
            "expense_approved",
        ]).notNullable();
        t.string("title", 255).notNullable();
        t.text("message").notNullable();
        t.string("entity_type", 50).nullable();
        t.string("entity_id", 36).nullable();
        t.boolean("is_read").notNullable().defaultTo(false);
        t.timestamps(true, true);
        t.index(["org_id", "user_id", "is_read"]);
        t.index(["org_id", "created_at"]);
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists("notifications");
}
//# sourceMappingURL=004_notifications.js.map
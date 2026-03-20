"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 003 — Organization Timezone
// Adds a `timezone` column to organizations table.
// ============================================================================
async function up(knex) {
    await knex.schema.alterTable("organizations", (t) => {
        t.string("timezone", 50).notNullable().defaultTo("UTC");
    });
}
async function down(knex) {
    await knex.schema.alterTable("organizations", (t) => {
        t.dropColumn("timezone");
    });
}
//# sourceMappingURL=003_org_timezone.js.map
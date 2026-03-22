import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("custom_domains", (t) => {
    t.string("id", 36).primary();
    t.string("org_id", 36).notNullable().references("id").inTable("organizations");
    t.string("domain", 255).notNullable().unique();
    t.boolean("verified").defaultTo(false);
    t.boolean("ssl_provisioned").defaultTo(false);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index("org_id");
    t.index("domain");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("custom_domains");
}

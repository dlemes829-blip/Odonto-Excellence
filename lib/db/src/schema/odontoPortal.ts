import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A single, versioned portal document keeps the operational dashboard in sync
 * between collaborators without coupling the portal UI to database columns.
 */
export const odontoPortalStates = pgTable("odonto_portal_states", {
  portalKey: text("portal_key").primaryKey(),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

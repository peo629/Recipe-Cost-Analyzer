import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Companies ───────────────────────────────────────────────────────────────
// Mirrors the `business_entities` MongoDB collection. One row per company.
// `head_office` is stored as an opaque jsonb blob matching the Mongo shape:
//   { address, suburb, state, post_code, contact }

export const companiesTable = pgTable(
  "companies",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    companyId: varchar("company_id").notNull(),
    companyName: varchar("company_name").notNull(),
    directorName: varchar("director_name"),
    acn: varchar("acn"),

    adminUserId: varchar("admin_user_id"),

    headOffice: jsonb("head_office"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("companies_company_id_idx").on(table.companyId)],
);

export type UpsertCompany = typeof companiesTable.$inferInsert;
export type Company = typeof companiesTable.$inferSelect;

// ─── Venues ──────────────────────────────────────────────────────────────────
// Mirrors the `business_venues` MongoDB collection. One row per venue.
// `company_id` is a FK to `companies.company_id` (the natural business key).
// `workareas` holds a jsonb array of { work_area_id, work_area_name } objects.
// The per-workarea employee lists are derived from the users table at query
// time and are NOT stored here.

export const venuesTable = pgTable(
  "venues",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    venueId: varchar("venue_id").notNull(),
    companyId: varchar("company_id")
      .notNull()
      .references(() => companiesTable.companyId),
    venueName: varchar("venue_name").notNull(),
    venueManagerId: varchar("venue_manager_id"),
    venueManagerName: varchar("venue_manager_name"),
    venueAdminId: varchar("venue_admin_id"),

    address: varchar("address"),
    suburb: varchar("suburb"),
    state: varchar("state"),
    postCode: varchar("post_code"),
    phone: varchar("phone"),
    email: varchar("email"),

    workareas: jsonb("workareas"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("venues_venue_id_idx").on(table.venueId)],
);

export type UpsertVenue = typeof venuesTable.$inferInsert;
export type Venue = typeof venuesTable.$inferSelect;

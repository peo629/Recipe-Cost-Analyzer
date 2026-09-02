import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// Server-side session store. Keyed by an opaque random session id (sid)
// stored in an httpOnly cookie. Required regardless of auth provider.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// `business_users`-flavoured user record. Mirrors the shape of the
// MongoDB business_users collection so that the eventual ETL is a
// one-to-one mapping. `passwordHash` is null for users that signed in
// only with Google; `googleSub` is null for users that signed up only
// with credentials. Both can be set when a user has linked both methods.
export const usersTable = pgTable(
  "users",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar("email").notNull(),
    passwordHash: varchar("password_hash"),
    googleSub: varchar("google_sub"),

    firstName: varchar("first_name"),
    lastName: varchar("last_name"),
    preferredName: varchar("preferred_name"),
    profileImageUrl: varchar("profile_image_url"),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: false }),
    personalContact: varchar("personal_contact"),

    // Embedded address subdocument.
    // { street, suburb, state, postCode }
    address: jsonb("address"),
    // Embedded next-of-kin subdocument.
    // { name, relationship, contact }
    nextOfKin: jsonb("next_of_kin"),

    // Hierarchical linking to the multi-tenant business structure.
    // Filled in by the onboarding flow / ETL; null for fresh signups.
    linkingId: varchar("linking_id"),
    payrollId: varchar("payroll_id"),
    companyId: varchar("company_id"),
    companyName: varchar("company_name"),
    venueId: varchar("venue_id"),
    venueName: varchar("venue_name"),
    workAreaId: varchar("work_area_id"),
    workAreaName: varchar("work_area_name"),
    roleId: varchar("role_id"),
    roleName: varchar("role_name"),

    // Role-based permission tags. Empty array for fresh signups; the
    // route-level authorization gate is intentionally a later task.
    // Allowed values mirror the Mongo enum: admin, executive,
    // venue_manager, supervisor, staff, viewer.
    permissions: text("permissions")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    // Employment / payroll / leave / accrual data are stored as opaque
    // JSON blobs for now and shaped into proper tables in the payroll
    // task. Keeps the schema close to the source of truth so the ETL
    // is a passthrough.
    employmentDetails: jsonb("employment_details"),
    leaveEntitlements: jsonb("leave_entitlements"),
    accruedEmployment: jsonb("accrued_employment"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
    uniqueIndex("users_google_sub_idx").on(table.googleSub),
    uniqueIndex("users_linking_id_idx").on(table.linkingId),
  ],
);

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;

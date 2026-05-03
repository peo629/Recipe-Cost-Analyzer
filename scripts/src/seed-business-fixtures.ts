#!/usr/bin/env tsx
/**
 * Seed script: business fixture data (companies, venues, employees)
 *
 * Loads one company (Melbourne Venue Co / CNY-2976), two venues
 * (Black Jacks Smokehouse / VEN-2976-30 and Gather & Graze / VEN-2976-31),
 * and all 10 employees referenced across both venues, plus the standalone
 * Peter Griffin admin record.
 *
 * Employee records are mapped to the existing `users` table (which mirrors the
 * MongoDB `business_users` collection). Date strings are converted to JS Date
 * objects; JSONB blobs (address, next_of_kin, employment_details,
 * leave_entitlements, accrued_employment) are set to null for placeholder
 * employees since the source data only carries identity/role metadata in the
 * venue workarea sub-documents. Peter Griffin has a populated employment block
 * matching the standalone record shape.
 *
 * The script is idempotent: re-running it will upsert existing rows keyed on
 * their natural business keys (company_id / venue_id / linking_id).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts seed:business
 */

import { db, companiesTable, venuesTable, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanyInsert = typeof companiesTable.$inferInsert;
type VenueInsert = typeof venuesTable.$inferInsert;
type UserInsert = typeof usersTable.$inferInsert;

// ─── Source data ─────────────────────────────────────────────────────────────

const COMPANY: CompanyInsert = {
  companyId: "CNY-2976",
  companyName: "Melbourne Venue Co",
  directorName: "Peter Griffin",
  acn: "123 456 789",
  adminUserId: "EMP-2976-3088-308020",
  headOffice: {
    address: "Level 10, 1 Collins Street",
    suburb: "Melbourne",
    state: "Victoria",
    post_code: "3000",
    contact: "+61396830000",
  },
};

const VENUES: VenueInsert[] = [
  {
    venueId: "VEN-2976-30",
    companyId: "CNY-2976",
    venueName: "Black Jacks Smokehouse",
    venueManagerName: "Norville Rogers",
    venueAdminId: "VEN-2976-308720",
    address: "5 Southbank Boulevard",
    suburb: "Southbank",
    state: "Victoria",
    postCode: "3006",
    phone: "+61396839999",
    email: "blackjacks@melbournevenueco.com.au",
    workareas: [
      { work_area_id: "WAI-2976-3087", work_area_name: "venue" },
      { work_area_id: "WAI-2976-3088", work_area_name: "kitchen" },
      { work_area_id: "WAI-2976-3089", work_area_name: "bar" },
    ],
  },
  {
    venueId: "VEN-2976-31",
    companyId: "CNY-2976",
    venueName: "Gather & Graze",
    venueManagerName: "Scooby Doo",
    venueAdminId: "VEN-2976-318721",
    address: "12 Collins Street",
    suburb: "Melbourne",
    state: "Victoria",
    postCode: "3000",
    phone: "+61396840000",
    email: "gathergraze@melbournevenueco.com.au",
    workareas: [
      { work_area_id: "WAI-2976-3187", work_area_name: "venue" },
      { work_area_id: "WAI-2976-3189", work_area_name: "bar" },
      { work_area_id: "WAI-2976-3190", work_area_name: "restaurant" },
      { work_area_id: "WAI-2976-3188", work_area_name: "kitchen" },
    ],
  },
];

// Employees sourced from both venue workareas + the standalone Peter Griffin
// admin record. Deduplicated by linking_id. Peter Griffin is G-Dog in
// Black Jacks Smokehouse kitchen.
//
// IMPORTANT: no employee in this fixture set has a password_hash. The seed
// only provisions the identity / role metadata. To actually log in, every
// employee — including Peter Griffin — must go through the onboarding flow
// (POST /api/auth/set-password with their linking_id). This keeps a
// known-plaintext credential out of source control and makes the fixture
// safe to load into any environment.
//
// JSONB blobs (address, next_of_kin, employment_details, leave_entitlements,
// accrued_employment) are null for placeholder employees because the source
// venue workarea sub-documents carry only identity/role metadata. These will
// be populated by the onboarding or payroll import flow.
const EMPLOYEES: UserInsert[] = [
  // ── Standalone admin record / Head Chef Black Jacks ───────────────────────
  {
    linkingId: "EMP-2976-3088-308020",
    payrollId: "DK-308020",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-30",
    venueName: "Black Jacks Smokehouse",
    workAreaId: "WAI-2976-3088",
    workAreaName: "kitchen",
    roleId: "BOH-EXE-207",
    roleName: "Head Chef",
    firstName: "Peter",
    lastName: "Griffin",
    preferredName: "G-Dog",
    email: "p.griffin@melbournevenueco.com.au",
    // No seed password — Peter Griffin must onboard via
    // POST /api/auth/set-password just like every other employee.
    passwordHash: null,
    permissions: ["admin", "executive"],
    // Employment details for the standalone admin record (Mongo-shaped blob).
    employmentDetails: {
      hired_date: new Date("2020-01-15").toISOString(),
      employment_type: "full_time",
      base_salary: null,
      hourly_rate: null,
    },
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },

  // ── Black Jacks Smokehouse (VEN-2976-30) ─────────────────────────────────
  {
    linkingId: "EMP-2976-3087-308720",
    payrollId: "DV-308720",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-30",
    venueName: "Black Jacks Smokehouse",
    workAreaId: "WAI-2976-3087",
    workAreaName: "venue",
    roleId: "FOH-EXE-306",
    roleName: "Venue Manager",
    firstName: "Norville",
    lastName: "Rogers",
    preferredName: "Shaggy",
    email: "n.rogers@melbournevenueco.com.au",
    passwordHash: null,
    permissions: ["venue_manager"],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
  {
    linkingId: "EMP-2976-3088-308049",
    payrollId: "DK-308049",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-30",
    venueName: "Black Jacks Smokehouse",
    workAreaId: "WAI-2976-3088",
    workAreaName: "kitchen",
    roleId: "BOH-EXE-206",
    roleName: "chef de cuisine",
    firstName: null,
    lastName: null,
    preferredName: "timjim",
    email: "timjim@melbournevenueco.com.au",
    passwordHash: null,
    permissions: [],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
  {
    linkingId: "EMP-2976-3089-520242",
    payrollId: "DB-520242",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-30",
    venueName: "Black Jacks Smokehouse",
    workAreaId: "WAI-2976-3089",
    workAreaName: "bar",
    roleId: "FOH-MGT-304",
    roleName: "Bar Manager",
    firstName: null,
    lastName: null,
    preferredName: "Penny",
    email: "penny@melbournevenueco.com.au",
    passwordHash: null,
    permissions: [],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },

  // ── Gather & Graze (VEN-2976-31) ─────────────────────────────────────────
  {
    linkingId: "EMP-2976-3187-318721",
    payrollId: "DV-318721",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-31",
    venueName: "Gather & Graze",
    workAreaId: "WAI-2976-3187",
    workAreaName: "venue",
    roleId: "FOH-EXE-306",
    roleName: "Venue Manager",
    firstName: "Scooby",
    lastName: "Doo",
    preferredName: "Scooby",
    email: "s.doo@melbournevenueco.com.au",
    passwordHash: null,
    permissions: ["venue_manager"],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
  {
    linkingId: "EMP-2976-3189-318745",
    payrollId: "DB-318745",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-31",
    venueName: "Gather & Graze",
    workAreaId: "WAI-2976-3189",
    workAreaName: "bar",
    roleId: "FOH-MGT-304",
    roleName: "Bar Manager",
    firstName: null,
    lastName: null,
    preferredName: "Velma",
    email: "velma@melbournevenueco.com.au",
    passwordHash: null,
    permissions: [],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
  {
    linkingId: "EMP-2976-3190-318760",
    payrollId: "DR-318760",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-31",
    venueName: "Gather & Graze",
    workAreaId: "WAI-2976-3190",
    workAreaName: "restaurant",
    roleId: "FOH-MGT-305",
    roleName: "Restaurant Manager",
    firstName: null,
    lastName: null,
    preferredName: "Fred",
    email: "fred@melbournevenueco.com.au",
    passwordHash: null,
    permissions: [],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
  {
    linkingId: "EMP-2976-3188-318780",
    payrollId: "DK-318780",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-31",
    venueName: "Gather & Graze",
    workAreaId: "WAI-2976-3188",
    workAreaName: "kitchen",
    roleId: "BOH-EXE-207",
    roleName: "Head Chef",
    firstName: null,
    lastName: null,
    preferredName: "Daphne",
    email: "daphne@melbournevenueco.com.au",
    passwordHash: null,
    permissions: [],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
  {
    linkingId: "EMP-2976-3188-318795",
    payrollId: "DK-318795",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-31",
    venueName: "Gather & Graze",
    workAreaId: "WAI-2976-3188",
    workAreaName: "kitchen",
    roleId: "BOH-DPM-210",
    roleName: "Chef De Partie",
    firstName: null,
    lastName: null,
    preferredName: "Shaggy Jr",
    email: "shaggyjr@melbournevenueco.com.au",
    passwordHash: null,
    permissions: [],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
  {
    linkingId: "EMP-2976-3188-318810",
    payrollId: "DK-318810",
    companyId: "CNY-2976",
    companyName: "Melbourne Venue Co",
    venueId: "VEN-2976-31",
    venueName: "Gather & Graze",
    workAreaId: "WAI-2976-3188",
    workAreaName: "kitchen",
    roleId: "BOH-EMP-215",
    roleName: "Commis Chef",
    firstName: null,
    lastName: null,
    preferredName: "Scrappy",
    email: "scrappy@melbournevenueco.com.au",
    passwordHash: null,
    permissions: [],
    employmentDetails: null,
    leaveEntitlements: null,
    accruedEmployment: null,
    address: null,
    nextOfKin: null,
  },
];

// ─── Seed ────────────────────────────────────────────────────────────────────

/**
 * Refuse to run against a production environment. The seed loads
 * deterministic fixture identities (Peter Griffin, the Scooby crew, etc.)
 * which are useful for dev / test / staging but have no place in a
 * customer-facing database. To override (e.g. populating a fresh staging
 * DB that happens to set NODE_ENV=production), set `ALLOW_SEED=1`.
 */
function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error(
      "Refusing to seed business fixtures: NODE_ENV=production. " +
        "Set ALLOW_SEED=1 to override (you almost never want to do this).",
    );
  }
}

export async function seed() {
  assertNotProduction();
  console.log("▶  Seeding business fixtures…\n");

  // 1. Companies — must be inserted before venues (FK dependency)
  const companyResult = await db
    .insert(companiesTable)
    .values(COMPANY)
    .onConflictDoUpdate({
      target: companiesTable.companyId,
      set: {
        companyName: sql`excluded.company_name`,
        directorName: sql`excluded.director_name`,
        acn: sql`excluded.acn`,
        adminUserId: sql`excluded.admin_user_id`,
        headOffice: sql`excluded.head_office`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ companyId: companiesTable.companyId });

  console.log(`  companies  → ${companyResult.length} row(s) upserted`);

  // 2. Venues
  const venueResult = await db
    .insert(venuesTable)
    .values(VENUES)
    .onConflictDoUpdate({
      target: venuesTable.venueId,
      set: {
        companyId: sql`excluded.company_id`,
        venueName: sql`excluded.venue_name`,
        venueManagerName: sql`excluded.venue_manager_name`,
        venueAdminId: sql`excluded.venue_admin_id`,
        address: sql`excluded.address`,
        suburb: sql`excluded.suburb`,
        state: sql`excluded.state`,
        postCode: sql`excluded.post_code`,
        phone: sql`excluded.phone`,
        email: sql`excluded.email`,
        workareas: sql`excluded.workareas`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ venueId: venuesTable.venueId });

  console.log(`  venues     → ${venueResult.length} row(s) upserted`);

  // 3. Employees (via existing users table, keyed on linking_id)
  const employeeResult = await db
    .insert(usersTable)
    .values(EMPLOYEES)
    .onConflictDoUpdate({
      target: usersTable.linkingId,
      set: {
        email: sql`excluded.email`,
        passwordHash: sql`excluded.password_hash`,
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        preferredName: sql`excluded.preferred_name`,
        payrollId: sql`excluded.payroll_id`,
        companyId: sql`excluded.company_id`,
        companyName: sql`excluded.company_name`,
        venueId: sql`excluded.venue_id`,
        venueName: sql`excluded.venue_name`,
        workAreaId: sql`excluded.work_area_id`,
        workAreaName: sql`excluded.work_area_name`,
        roleId: sql`excluded.role_id`,
        roleName: sql`excluded.role_name`,
        permissions: sql`excluded.permissions`,
        address: sql`excluded.address`,
        nextOfKin: sql`excluded.next_of_kin`,
        employmentDetails: sql`excluded.employment_details`,
        leaveEntitlements: sql`excluded.leave_entitlements`,
        accruedEmployment: sql`excluded.accrued_employment`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ linkingId: usersTable.linkingId });

  console.log(`  employees  → ${employeeResult.length} row(s) upserted\n`);

  console.log("✅ Done.\n");
  console.log("Summary:");
  console.log(
    `  1 company  (${COMPANY.companyId} — ${COMPANY.companyName})`
  );
  console.log(
    `  ${VENUES.length} venues    (${VENUES.map((v) => v.venueId).join(", ")})`
  );
  console.log(`  ${employeeResult.length} employees`);
}

// Only run as a CLI entry-point; skip when the module is imported by tests.
const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMain) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}

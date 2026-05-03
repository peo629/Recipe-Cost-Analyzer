/**
 * Integration tests for the business fixture seed.
 *
 * Verifies that the seeded data satisfies the "done" criteria from task-18:
 *  - 1 company (CNY-2976 — Melbourne Venue Co)
 *  - 2 venues both linked to CNY-2976
 *  - 10 employees correctly distributed across venues / work areas
 *  - Peter Griffin's password_hash round-trips via bcrypt
 *  - Re-running the seed does not create duplicates (idempotency)
 *
 * The seed is invoked in beforeAll so these tests are fully self-contained and
 * do not depend on the fixture having been loaded by an external step first.
 */

import { beforeAll, describe, it, expect } from "vitest";
import { eq, and, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  usersTable,
  companiesTable,
  venuesTable,
} from "../../lib/db/src/index";
import { seed } from "../../scripts/src/seed-business-fixtures";

const COMPANY_ID = "CNY-2976";
const PETER_LINKING_ID = "EMP-2976-3088-308020";
const PETER_SEED_PASSWORD = "PeterGriffin1!";

beforeAll(async () => {
  // Ensure fixture data is present before any test runs.
  // The seed is idempotent so it is safe to call even if data already exists.
  await seed();
});

describe("Business fixtures — companies table", () => {
  it("contains exactly 1 company with the correct id and name", async () => {
    const rows = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.companyId, COMPANY_ID));

    expect(rows).toHaveLength(1);
    expect(rows[0].companyName).toBe("Melbourne Venue Co");
    expect(rows[0].directorName).toBe("Peter Griffin");
  });

  it("has a populated head_office jsonb blob", async () => {
    const [company] = await db
      .select({ headOffice: companiesTable.headOffice })
      .from(companiesTable)
      .where(eq(companiesTable.companyId, COMPANY_ID));

    expect(company).toBeDefined();
    const ho = company.headOffice as Record<string, unknown>;
    expect(typeof ho.address).toBe("string");
    expect(typeof ho.suburb).toBe("string");
  });
});

describe("Business fixtures — venues table", () => {
  it("contains exactly 2 venues both linked to CNY-2976", async () => {
    const rows = await db
      .select()
      .from(venuesTable)
      .where(eq(venuesTable.companyId, COMPANY_ID));

    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.venueId).sort();
    expect(ids).toEqual(["VEN-2976-30", "VEN-2976-31"]);
  });

  it("Black Jacks Smokehouse has 3 work areas in workareas blob", async () => {
    const [venue] = await db
      .select({ workareas: venuesTable.workareas })
      .from(venuesTable)
      .where(eq(venuesTable.venueId, "VEN-2976-30"));

    expect(venue).toBeDefined();
    const areas = venue.workareas as Array<{ work_area_id: string }>;
    expect(areas).toHaveLength(3);
    const waIds = areas.map((a) => a.work_area_id).sort();
    expect(waIds).toEqual(
      ["WAI-2976-3087", "WAI-2976-3088", "WAI-2976-3089"].sort()
    );
  });

  it("Gather & Graze has 4 work areas in workareas blob", async () => {
    const [venue] = await db
      .select({ workareas: venuesTable.workareas })
      .from(venuesTable)
      .where(eq(venuesTable.venueId, "VEN-2976-31"));

    expect(venue).toBeDefined();
    const areas = venue.workareas as Array<{ work_area_id: string }>;
    expect(areas).toHaveLength(4);
  });
});

describe("Business fixtures — employees (users table)", () => {
  it("has 10 employees linked to CNY-2976", async () => {
    const [{ value }] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.companyId, COMPANY_ID));

    expect(Number(value)).toBe(10);
  });

  it("has 4 employees in Black Jacks Smokehouse", async () => {
    const [{ value }] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.venueId, "VEN-2976-30"));

    expect(Number(value)).toBe(4);
  });

  it("has 6 employees in Gather & Graze", async () => {
    const [{ value }] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.venueId, "VEN-2976-31"));

    expect(Number(value)).toBe(6);
  });

  it("has 2 employees in Black Jacks kitchen (WAI-2976-3088)", async () => {
    const [{ value }] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.venueId, "VEN-2976-30"),
          eq(usersTable.workAreaId, "WAI-2976-3088")
        )
      );

    expect(Number(value)).toBe(2);
  });

  it("has 3 employees in Gather & Graze kitchen (WAI-2976-3188)", async () => {
    const [{ value }] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.venueId, "VEN-2976-31"),
          eq(usersTable.workAreaId, "WAI-2976-3188")
        )
      );

    expect(Number(value)).toBe(3);
  });
});

describe("Business fixtures — Peter Griffin record", () => {
  it("has a non-null password_hash", async () => {
    const [peter] = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.linkingId, PETER_LINKING_ID));

    expect(peter).toBeDefined();
    expect(peter.passwordHash).not.toBeNull();
  });

  it("password_hash round-trips correctly via bcrypt.compare", async () => {
    const [peter] = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.linkingId, PETER_LINKING_ID));

    expect(peter?.passwordHash).toBeDefined();
    const match = await bcrypt.compare(
      PETER_SEED_PASSWORD,
      peter.passwordHash!
    );
    expect(match).toBe(true);
  });

  it("has admin and executive permissions", async () => {
    const [peter] = await db
      .select({ permissions: usersTable.permissions })
      .from(usersTable)
      .where(eq(usersTable.linkingId, PETER_LINKING_ID));

    expect(peter?.permissions).toContain("admin");
    expect(peter?.permissions).toContain("executive");
  });

  it("has a populated employment_details blob", async () => {
    const [peter] = await db
      .select({ employmentDetails: usersTable.employmentDetails })
      .from(usersTable)
      .where(eq(usersTable.linkingId, PETER_LINKING_ID));

    expect(peter?.employmentDetails).not.toBeNull();
    const ed = peter.employmentDetails as Record<string, unknown>;
    expect(ed.hired_date).toBeDefined();
    expect(ed.employment_type).toBe("full_time");
  });
});

describe("Business fixtures — idempotency (seed re-run)", () => {
  it("row counts are unchanged after running the seed a second time", async () => {
    // Capture counts before the re-run.
    const countBefore = async () => {
      const [companies] = await db
        .select({ value: count() })
        .from(companiesTable)
        .where(eq(companiesTable.companyId, COMPANY_ID));
      const [venues] = await db
        .select({ value: count() })
        .from(venuesTable)
        .where(eq(venuesTable.companyId, COMPANY_ID));
      const [employees] = await db
        .select({ value: count() })
        .from(usersTable)
        .where(eq(usersTable.companyId, COMPANY_ID));
      return {
        companies: Number(companies.value),
        venues: Number(venues.value),
        employees: Number(employees.value),
      };
    };

    const before = await countBefore();

    // Run the seed a second time (on top of already-seeded data).
    await seed();

    const after = await countBefore();

    expect(after.companies).toBe(before.companies);
    expect(after.venues).toBe(before.venues);
    expect(after.employees).toBe(before.employees);
  });
});

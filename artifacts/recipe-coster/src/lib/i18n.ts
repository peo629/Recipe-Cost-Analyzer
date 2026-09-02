/**
 * Australia/Melbourne localisation helpers.
 *
 * One module owns the AU formatting rules so individual pages don't sprinkle
 * `toFixed(2)` / ad-hoc `$` symbols / `toLocaleString` calls.
 *
 *   formatCurrency(12.3)             → "$A 12.30"
 *   formatUnitCost(0.0345)           → "$A 0.0345"
 *   formatDate("2026-05-02T...")     → "02/05/2026"
 *   formatDateTime("2026-05-02...")  → "02/05/2026, 09:15"   (Australia/Melbourne)
 */

const TIMEZONE = "Australia/Melbourne";
const LOCALE = "en-AU";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "AUD",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const unitCostFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "AUD",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "AUD 12.34" → "$A 12.34" (unambiguous vs bare `$`); handles negative/accounting variants. */
function brand(out: string): string {
  return out.replace(/AUD\s?/g, "$A ");
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "$A 0.00";
  return brand(currencyFormatter.format(value));
}

export function formatUnitCost(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "$A 0.0000";
  return brand(unitCostFormatter.format(value));
}

function toDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(
  input: Date | string | number | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return "";
  return dateFormatter.format(d);
}

export function formatDateTime(
  input: Date | string | number | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return "";
  return dateTimeFormatter.format(d);
}

/** Deterministic YYYY-MM-DD using Australia/Melbourne calendar day (for filenames / sortable stamps). */
export function formatDateForFilename(
  input: Date | string | number = new Date(),
): string {
  const d = toDate(input);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (Number.isNaN(value)) return "0%";
  return `${value.toFixed(fractionDigits)}%`;
}

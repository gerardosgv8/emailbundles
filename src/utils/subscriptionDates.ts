/**
 * Compare subscription end to "now" in a way that matches typical FastAPI responses:
 * - `YYYY-MM-DD` → valid through end of that calendar day in UTC (exclusive next-day midnight).
 * - Datetime without timezone → treated as UTC (append `Z` when a `T` is present).
 */
export function isSubscriptionEndUtcPassed(expirationDate: string | undefined | null): boolean {
  if (expirationDate == null || expirationDate === '') return false;
  const trimmed = String(expirationDate).trim();
  if (!trimmed) return false;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const mo = Number(dateOnly[2]) - 1;
    const d = Number(dateOnly[3]);
    const endExclusiveUtc = Date.UTC(y, mo, d + 1, 0, 0, 0, 0);
    return Date.now() >= endExclusiveUtc;
  }

  // "YYYY-MM-DD HH:MM:SS" from Postgres/ORM without timezone → treat as UTC (matches backend naive-UTC)
  const sqlLike = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(trimmed);
  if (sqlLike) {
    const y = Number(sqlLike[1]);
    const mo = Number(sqlLike[2]) - 1;
    const d = Number(sqlLike[3]);
    const h = Number(sqlLike[4]);
    const mi = Number(sqlLike[5]);
    const s = Number(sqlLike[6]);
    const endUtc = Date.UTC(y, mo, d, h, mi, s, 0);
    return Date.now() >= endUtc;
  }

  const afterT = trimmed.includes('T') ? trimmed.slice(trimmed.indexOf('T') + 1) : '';
  const hasTz = /[zZ]$/.test(trimmed) || (afterT !== '' && /[+-]\d{2}/.test(afterT));
  const toParse = hasTz ? trimmed : trimmed.includes('T') ? `${trimmed}Z` : trimmed;
  const parsed = Date.parse(toParse);
  if (Number.isNaN(parsed)) return false;
  return Date.now() >= parsed;
}

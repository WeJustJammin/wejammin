/**
 * BE00 429 `RATE_LIMITED` declares `resetAt` as an RFC 3339 string. The Worker
 * emits the limiter window end as a UTC instant (`YYYY-MM-DDTHH:MM:SS[.fff]Z`);
 * every web boundary that relays 429 details validates it here so a malformed,
 * oversized or calendar-impossible value never crosses to the browser.
 */
const RFC3339_UTC =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/u;

const MAX_RESET_AT_LENGTH = 30;

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export const rfc3339ResetAt = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > MAX_RESET_AT_LENGTH)
    return null;
  const match = RFC3339_UTC.exec(value);
  if (match === null) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number) as [number, number, number, number, number, number];
  return month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
    ? value
    : null;
};

/**
 * CMS composition Workers predate the RFC 3339 `resetAt` and still emit the
 * limiter window end as epoch seconds (a number, or a decimal string). The
 * relay keeps exactly the form its own Worker emits and, in addition, any
 * valid RFC 3339 instant; every other value is dropped.
 */
export type LegacyResetAt = 'epoch-number' | 'epoch-string';

const EPOCH_STRING = /^\d{1,13}$/u;

export const relayedResetAt = (
  value: unknown,
  legacy: LegacyResetAt,
): string | number | null => {
  const instant = rfc3339ResetAt(value);
  if (instant !== null) return instant;
  if (legacy === 'epoch-number')
    return typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  return typeof value === 'string' && EPOCH_STRING.test(value) ? value : null;
};

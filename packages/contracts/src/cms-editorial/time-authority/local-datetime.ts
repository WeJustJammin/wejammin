/*
 * Calendar arithmetic for the CMS Time authority (BE03b E8): offset-free local
 * datetimes and ISO instants read to exact seconds plus nanoseconds, and
 * formatted back. Pure and dependency-free so the Worker and the schedule form
 * run the very same code.
 */

/** Days from 1970-01-01 to the proleptic Gregorian date (Hinnant's days_from_civil). */
export const daysFromCivil = (
  year: number,
  month: number,
  day: number,
): number => {
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
};

/** The proleptic Gregorian date of a day count (Hinnant's civil_from_days). */
export const civilFromDays = (
  days: number,
): { year: number; month: number; day: number } => {
  const shifted = days + 719_468;
  const era = Math.floor(shifted / 146_097);
  const dayOfEra = shifted - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1_460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  return {
    year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0),
    month,
    day,
  };
};

/** True when (year, month, day) is a real calendar date. */
const isRealDate = (year: number, month: number, day: number): boolean => {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const back = civilFromDays(daysFromCivil(year, month, day));
  return back.year === year && back.month === month && back.day === day;
};

/** A parsed offset-free local datetime: wall-clock seconds as if they were UTC. */
export type ParsedLocalDateTime = Readonly<{
  naiveSeconds: number;
  nanos: number;
  hasSeconds: boolean;
  fractionDigits: number;
}>;

const LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/u;

const nanosOf = (fraction: string | undefined): number =>
  fraction === undefined ? 0 : Number(fraction.padEnd(9, '0'));

/** Reads `YYYY-MM-DDTHH:mm[:ss[.f{1,9}]]`, or null for any other shape or an impossible time. */
export const parseLocalDateTime = (
  text: string,
): ParsedLocalDateTime | null => {
  const match = LOCAL_PATTERN.exec(text);
  if (match === null) return null;
  const [year, month, day, hour, minute] = [1, 2, 3, 4, 5].map((index) =>
    Number(match[index]),
  ) as [number, number, number, number, number];
  const second = match[6] === undefined ? 0 : Number(match[6]);
  if (!isRealDate(year, month, day) || hour > 23 || minute > 59 || second > 59)
    return null;
  return {
    naiveSeconds:
      daysFromCivil(year, month, day) * 86_400 +
      hour * 3_600 +
      minute * 60 +
      second,
    nanos: nanosOf(match[7]),
    hasSeconds: match[6] !== undefined,
    fractionDigits: match[7]?.length ?? 0,
  };
};

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0');

const clock = (naiveSeconds: number) => {
  const days = Math.floor(naiveSeconds / 86_400);
  const inDay = naiveSeconds - days * 86_400;
  const { year, month, day } = civilFromDays(days);
  return {
    date: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`,
    hour: Math.floor(inDay / 3_600),
    minute: Math.floor((inDay % 3_600) / 60),
    second: inDay % 60,
  };
};

const fraction = (nanos: number, digits: number): string =>
  digits === 0 ? '' : `.${pad(nanos, 9).slice(0, digits)}`;

/** Formats naive wall-clock seconds as a local datetime with the template's precision. */
export const formatLocalDateTime = (
  naiveSeconds: number,
  template: Pick<
    ParsedLocalDateTime,
    'hasSeconds' | 'fractionDigits' | 'nanos'
  >,
): string => {
  const { date, hour, minute, second } = clock(naiveSeconds);
  const base = `${date}T${pad(hour, 2)}:${pad(minute, 2)}`;
  return template.hasSeconds
    ? `${base}:${pad(second, 2)}${fraction(template.nanos, template.fractionDigits)}`
    : base;
};

/** Formats a UTC instant as `YYYY-MM-DDTHH:mm:ss[.f]Z`. */
export const formatUtcInstant = (
  seconds: number,
  nanos: number,
  fractionDigits: number,
): string => {
  const { date, hour, minute, second } = clock(seconds);
  return `${date}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}${fraction(nanos, fractionDigits)}Z`;
};

const INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/u;

/** An exact instant: whole seconds since the epoch plus nanoseconds. */
export type ParsedInstant = Readonly<{ seconds: number; nanos: number }>;

/** Reads an ISO instant with `Z` or a numeric offset, or null for any other shape. */
export const parseInstant = (text: string): ParsedInstant | null => {
  const match = INSTANT_PATTERN.exec(text);
  const zone = match?.[8];
  if (match === null || zone === undefined) return null;
  const local = parseLocalDateTime(text.slice(0, text.length - zone.length));
  if (local === null) return null;
  let offsetSeconds = 0;
  if (zone !== 'Z') {
    const digits = zone.slice(1).replace(':', '');
    const hours = Number(digits.slice(0, 2));
    const minutes = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
    if (hours > 23 || minutes > 59) return null;
    offsetSeconds =
      (zone.startsWith('-') ? -1 : 1) * (hours * 3_600 + minutes * 60);
  }
  return { seconds: local.naiveSeconds - offsetSeconds, nanos: local.nanos };
};

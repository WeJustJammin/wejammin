import { civilFromDays, daysFromCivil } from './local-datetime.ts';

/*
 * The POSIX TZ footer of a TZif file (RFC 8536 section 3.3) governs the instants
 * after a zone's last explicit transition. The pinned 2026e release emits only
 * fixed-offset footers and `Mm.w.d[/time]` rules, so this parser supports exactly
 * those forms and refuses anything else instead of guessing.
 */

/** `Mm.w.d/time`: month 1-12, week 1-5 (5 = last), weekday 0-6 (0 = Sunday), local seconds. */
export type FooterRule = Readonly<{
  month: number;
  week: number;
  weekday: number;
  time: number;
}>;

export type ParsedFooter = Readonly<{
  /** UT offset of standard time in seconds (east of UTC positive). */
  standardOffset: number;
  daylight: Readonly<{
    offset: number;
    start: FooterRule;
    end: FooterRule;
  }> | null;
}>;

export type FooterTransition = Readonly<{
  at: number;
  before: number;
  after: number;
}>;

const fail = (footer: string): never => {
  throw new Error(`Unsupported POSIX TZ footer: ${JSON.stringify(footer)}`);
};

/** `[+-]hh[:mm[:ss]]` to seconds, or null. */
const clockSeconds = (text: string): number | null => {
  const match = /^([+-]?)(\d{1,3})(?::(\d{2}))?(?::(\d{2}))?$/u.exec(text);
  if (match === null) return null;
  const seconds =
    Number(match[2]) * 3_600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0);
  return match[1] === '-' ? -seconds : seconds;
};

const NAME = '(?:<[^<>]+>|[A-Za-z]{3,})';
const OFFSET = '[+-]?\\d{1,2}(?::\\d{2}(?::\\d{2})?)?';
const RULE =
  '(M\\d{1,2}\\.\\d\\.\\d)(?:/([+-]?\\d{1,3}(?::\\d{2}(?::\\d{2})?)?))?';
const FOOTER_PATTERN = new RegExp(
  `^${NAME}(${OFFSET})(?:${NAME}(${OFFSET})?,${RULE},${RULE})?$`,
  'u',
);

const parseRule = (
  rule: string | undefined,
  time: string | undefined,
  footer: string,
): FooterRule => {
  const match = /^M(\d{1,2})\.(\d)\.(\d)$/u.exec(rule ?? '');
  if (match === null) return fail(footer);
  const month = Number(match[1]);
  const week = Number(match[2]);
  const weekday = Number(match[3]);
  const seconds = time === undefined ? 7_200 : clockSeconds(time);
  if (
    month < 1 ||
    month > 12 ||
    week < 1 ||
    week > 5 ||
    weekday > 6 ||
    seconds === null
  )
    return fail(footer);
  return { month, week, weekday, time: seconds };
};

/** Parses a footer; throws for any form the pinned release does not emit. */
export const parseFooter = (footer: string): ParsedFooter => {
  const match = FOOTER_PATTERN.exec(footer);
  if (match === null) return fail(footer);
  const standardWest = clockSeconds(match[1] ?? '');
  if (standardWest === null) return fail(footer);
  // `0 - x` rather than `-x` so a zero offset is +0, never -0.
  const standardOffset = 0 - standardWest;
  if (match[3] === undefined) return { standardOffset, daylight: null };
  const daylightWest = match[2] === undefined ? null : clockSeconds(match[2]);
  const offset =
    daylightWest === null ? standardOffset + 3_600 : 0 - daylightWest;
  return {
    standardOffset,
    daylight: {
      offset,
      start: parseRule(match[3], match[4], footer),
      end: parseRule(match[5], match[6], footer),
    },
  };
};

const daysInMonth = (year: number, month: number): number =>
  month === 12
    ? 31
    : daysFromCivil(year, month + 1, 1) - daysFromCivil(year, month, 1);

/** Local (wall-clock) seconds since the epoch of a rule's transition in `year`. */
const ruleLocalSeconds = (year: number, rule: FooterRule): number => {
  const firstDay = daysFromCivil(year, rule.month, 1);
  const weekdayOfFirst = (((firstDay + 4) % 7) + 7) % 7;
  let day = 1 + ((rule.weekday - weekdayOfFirst + 7) % 7) + (rule.week - 1) * 7;
  const length = daysInMonth(year, rule.month);
  while (day > length) day -= 7;
  return daysFromCivil(year, rule.month, day) * 86_400 + rule.time;
};

const yearOf = (utcSeconds: number, offset: number): number =>
  civilFromDays(Math.floor((utcSeconds + offset) / 86_400)).year;

/** The UTC instants of both DST changes in `year`: start (to DST) and end (back to standard). */
const yearChanges = (
  footer: ParsedFooter,
  year: number,
): { start: number; end: number } | null => {
  if (footer.daylight === null) return null;
  return {
    start:
      ruleLocalSeconds(year, footer.daylight.start) - footer.standardOffset,
    end: ruleLocalSeconds(year, footer.daylight.end) - footer.daylight.offset,
  };
};

/** The UT offset in effect at a UTC instant according to the footer. */
export const footerOffsetAt = (
  footer: ParsedFooter,
  utcSeconds: number,
): number => {
  const changes = yearChanges(
    footer,
    yearOf(utcSeconds, footer.standardOffset),
  );
  if (changes === null || footer.daylight === null)
    return footer.standardOffset;
  const inDaylight =
    changes.start < changes.end
      ? utcSeconds >= changes.start && utcSeconds < changes.end
      : utcSeconds >= changes.start || utcSeconds < changes.end;
  return inDaylight ? footer.daylight.offset : footer.standardOffset;
};

/** The footer's offset changes at instants in the window `(low, high]`, in time order. */
export const footerTransitions = (
  footer: ParsedFooter,
  low: number,
  high: number,
): readonly FooterTransition[] => {
  const daylight = footer.daylight;
  if (daylight === null) return [];
  const found: FooterTransition[] = [];
  for (
    let year = yearOf(low, footer.standardOffset) - 1;
    year <= yearOf(high, footer.standardOffset) + 1;
    year += 1
  ) {
    const changes = yearChanges(footer, year);
    if (changes === null) continue;
    for (const candidate of [
      {
        at: changes.start,
        before: footer.standardOffset,
        after: daylight.offset,
      },
      {
        at: changes.end,
        before: daylight.offset,
        after: footer.standardOffset,
      },
    ])
      if (candidate.at > low && candidate.at <= high) found.push(candidate);
  }
  return found.sort((left, right) => left.at - right.at);
};

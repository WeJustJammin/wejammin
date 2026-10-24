/** A short, unambiguous name for an entry in control labels: the entry id has no title to show. */
export const entryName = (entryId: string): string =>
  `entry ${entryId.slice(-12)}`;

const INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/u;

/** `2026-10-15T11:00:00Z` as `2026-10-15 11:00 UTC`; anything else is shown verbatim. */
export const formatInstant = (instant: string): string => {
  const match = INSTANT.exec(instant);
  return match === null || !instant.endsWith('Z')
    ? instant
    : `${match[1]} ${match[2]} UTC`;
};

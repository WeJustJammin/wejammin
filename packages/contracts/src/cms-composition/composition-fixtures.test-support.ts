/**
 * Slice 12 valid fixtures for the governed-review, pattern, taxonomy, locale
 * and related-content contract suites. Each is one canonical accepted value; a
 * test derives its invalid variants from it so every refusal names exactly the
 * member it breaks.
 */

/** A distinct valid lowercase UUID per index, for lists that need many ids. */
export const uid = (index: number): string =>
  `123e4567-e89b-42d3-a456-${String(426614175000 + index)}`;

export const uuid = uid(1);
export const uuid2 = uid(2);
export const uuid3 = uid(3);
export const hash = 'a'.repeat(64);
export const hash2 = 'b'.repeat(64);
export const instant = '2026-10-13T12:00:00Z';
export const laterInstant = '2026-10-14T12:00:00Z';

/** A copy of `value` without `key` (the lint-clean way to build an invalid variant). */
export const without = <T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(value).filter(([name]) => name !== key),
  ) as Omit<T, K>;

/** True when the schema refuses the candidate. */
export const isRefused = (
  schema: { safeParse: (value: unknown) => { success: boolean } },
  candidate: unknown,
): boolean => !schema.safeParse(candidate).success;

/** The issue paths a schema reports for a candidate, dot-joined. */
export const issuePaths = (
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: readonly { path: readonly PropertyKey[] }[] };
    };
  },
  candidate: unknown,
): string[] => {
  const parsed = schema.safeParse(candidate);
  return parsed.success
    ? []
    : (parsed.error?.issues.map((issue) => issue.path.join('.')) ?? []);
};

/** The issue messages a schema reports for a candidate. */
export const issueMessages = (
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: readonly { message: string }[] };
    };
  },
  candidate: unknown,
): string[] => {
  const parsed = schema.safeParse(candidate);
  return parsed.success
    ? []
    : (parsed.error?.issues.map((issue) => issue.message) ?? []);
};

/** Valid `ResourceMeta` members for a resource fixture. */
export const resourceMeta = {
  id: uid(10),
  version: '3',
  contentHash: hash,
  createdAt: instant,
  updatedAt: laterInstant,
} as const;

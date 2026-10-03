import { LOCALE_CONFIG_MESSAGES } from '@wejammin/contracts';

/**
 * BE03a OD-4 locale-configuration refusals are server-owned constant strings,
 * so a local 422 may carry them (never echoed input) with an RFC 6901 JSON
 * Pointer in the BE00 `FieldViolation.path` member.
 * Every other issue exposes no text, matching the platform `violations` shape.
 */
const LOCALE_MESSAGES: ReadonlySet<string> = new Set(
  Object.values(LOCALE_CONFIG_MESSAGES),
);

const pointerFor = (path: readonly PropertyKey[]): string =>
  `/${path
    .map((segment) =>
      String(segment).replaceAll('~', '~0').replaceAll('/', '~1'),
    )
    .join('/')}`;

export interface LocaleViolation {
  readonly path?: string;
  readonly message: string;
}

export const localeViolations = (
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): readonly LocaleViolation[] =>
  issues
    .filter((issue) => LOCALE_MESSAGES.has(issue.message))
    .slice(0, 50)
    .map((issue) => {
      const pointer = pointerFor(issue.path);
      return /^[\x20-\x7e]{1,256}$/u.test(pointer)
        ? { path: pointer, message: issue.message }
        : { message: issue.message };
    });

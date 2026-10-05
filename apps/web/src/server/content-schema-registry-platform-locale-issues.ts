import {
  LOCALE_CONFIG_MESSAGES,
  TEMPLATE_BINDING_MESSAGES,
} from '@wejammin/contracts';

/**
 * BE03a OD-4 locale-configuration refusals and the DEC-123 template-binding
 * refusals are server-owned constant strings, so a local 422 may carry them
 * (never echoed input) with an RFC 6901 JSON Pointer in the BE00
 * `FieldViolation.path` member. Every other issue carries its pointer only: it
 * names the field so the form can link and mark it (FE03 form validation), and
 * exposes no text, so no input or schema internals are ever echoed.
 */
const LOCALE_MESSAGES: ReadonlySet<string> = new Set([
  ...Object.values(LOCALE_CONFIG_MESSAGES),
  ...Object.values(TEMPLATE_BINDING_MESSAGES),
]);

const MAX_VIOLATIONS = 50;

const pointerFor = (path: readonly PropertyKey[]): string =>
  `/${path
    .map((segment) =>
      String(segment).replaceAll('~', '~0').replaceAll('/', '~1'),
    )
    .join('/')}`;

export interface FieldViolation {
  readonly path?: string;
  readonly message?: string;
}

export const fieldViolations = (
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): readonly FieldViolation[] =>
  issues
    // A whole-payload issue has no field to point at and no safe text.
    .filter(
      (issue) => issue.path.length > 0 || LOCALE_MESSAGES.has(issue.message),
    )
    .slice(0, MAX_VIOLATIONS)
    .map((issue): FieldViolation => {
      const pointer = pointerFor(issue.path);
      const path = /^[\x20-\x7e]{1,256}$/u.test(pointer) ? pointer : undefined;
      const message = LOCALE_MESSAGES.has(issue.message)
        ? issue.message
        : undefined;
      return {
        ...(path === undefined ? {} : { path }),
        ...(message === undefined ? {} : { message }),
      };
    })
    .filter(
      (violation) =>
        violation.path !== undefined || violation.message !== undefined,
    );

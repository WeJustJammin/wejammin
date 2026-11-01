import type { z } from 'zod';

import { CmsVersionSchema } from '../content-schema-registry/primitives.ts';
import { QuotedVersionSchema } from '../request-navigation-security.ts';

/*
 * BE03b If-Match operands (single definition): wherever a request body carries
 * `expectedVersion`, the strong `If-Match` must equal it exactly, because both
 * name the same operand. A mismatch is 400 `INVALID_REQUEST`, a header fault,
 * so the composite transport schemas report it at `headers.ifMatch`.
 */

/** The decimal operand of a strong quoted `If-Match`, or null when it is not one. */
export const cmsEditorialIfMatchOperand = (ifMatch: string): string | null =>
  QuotedVersionSchema.safeParse(ifMatch).success ? ifMatch.slice(1, -1) : null;

/**
 * BE03b If-Match operands: wherever a body carries `expectedVersion`, the
 * strong `If-Match` must equal it exactly (a mismatch is 400
 * `INVALID_REQUEST`) because both name the same operand.
 */
export const cmsEditorialIfMatchEqualsExpectedVersion = (
  ifMatch: string,
  expectedVersion: string,
): boolean => {
  const operand = cmsEditorialIfMatchOperand(ifMatch);
  return operand !== null && operand === expectedVersion;
};

/** The issue message of an `If-Match` that differs from the body `expectedVersion`. */
export const CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH =
  'if_match_must_equal_expected_version';

/** The composite transport members the equality refinement reads. */
interface IfMatchBoundRequest {
  readonly headers: { readonly ifMatch: string };
  readonly body: { readonly expectedVersion: string };
}

/**
 * `superRefine` body for a composite transport schema (`{ headers, body }`)
 * whose body carries `expectedVersion`. A malformed `If-Match` is already a
 * headers-schema issue and a malformed `expectedVersion` a body-schema issue,
 * so the equality is judged only when both are well formed: each fault is
 * reported once, at the member that owns it.
 */
export const refineIfMatchEqualsExpectedVersion = (
  value: IfMatchBoundRequest,
  context: z.RefinementCtx,
): void => {
  const operand = cmsEditorialIfMatchOperand(value.headers.ifMatch);
  const expectedVersion = value.body.expectedVersion;
  if (
    operand === null ||
    !CmsVersionSchema.safeParse(expectedVersion).success ||
    operand === expectedVersion
  )
    return;
  context.addIssue({
    code: 'custom',
    path: ['headers', 'ifMatch'],
    message: CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH,
  });
};

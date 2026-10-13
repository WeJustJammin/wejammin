import type { z } from 'zod';

import {
  CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH,
  cmsEditorialIfMatchOperand,
} from '../cms-editorial/if-match.ts';

/*
 * CMS-03C-12 and CMS-03C-16 create a new lineage with `expectedVersion: null`
 * (the S09 form) and a successor with the parent's `version`. The strong
 * `If-Match` is the same operand, so it is absent on a first version and equal
 * to `expectedVersion` on a successor. Each fault is reported once, at
 * `headers.ifMatch`.
 */

export const CMS_IF_MATCH_REQUIRED_ON_EDIT = 'if_match_required_on_edit';
export const CMS_IF_MATCH_FORBIDDEN_ON_CREATE = 'if_match_forbidden_on_create';

interface ConditionalRequest {
  readonly headers: { readonly ifMatch?: string | undefined };
  readonly body: { readonly expectedVersion: string | null };
}

export const refineConditionalIfMatch = (
  value: ConditionalRequest,
  context: z.RefinementCtx,
): void => {
  const { ifMatch } = value.headers;
  const { expectedVersion } = value.body;
  if (expectedVersion === null) {
    if (ifMatch !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['headers', 'ifMatch'],
        message: CMS_IF_MATCH_FORBIDDEN_ON_CREATE,
      });
    return;
  }
  if (ifMatch === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['headers', 'ifMatch'],
      message: CMS_IF_MATCH_REQUIRED_ON_EDIT,
    });
    return;
  }
  const operand = cmsEditorialIfMatchOperand(ifMatch);
  // A malformed If-Match is already a headers-schema issue.
  if (operand !== null && operand !== expectedVersion)
    context.addIssue({
      code: 'custom',
      path: ['headers', 'ifMatch'],
      message: CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH,
    });
};

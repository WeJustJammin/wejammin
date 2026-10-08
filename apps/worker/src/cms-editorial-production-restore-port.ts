import {
  EntryRevisionResourceSchema,
  RevisionRestoreVerificationSchema,
} from '@wejammin/contracts';
import type {
  EntryRevisionResource,
  RevisionRestoreVerification,
} from '@wejammin/contracts';

import { invalidResponse, isRecord } from './cms-editorial-production-errors';
import type { CmsEditorialPortInput } from './cms-editorial-production-session';
import type { CmsEditorialProductionResult } from './cms-editorial-production-types';

/** Private port result: the public resource plus the trusted restore proof. */
export type CmsEditorialRestorePortValue = Readonly<{
  resource: EntryRevisionResource;
  restoreVerification: RevisionRestoreVerification;
}>;

/**
 * Validate and narrow the private restore envelope. The RPC returns the public
 * restored resource beside the trusted server-produced `restoreVerification`;
 * either half failing its strict contract is a 502, never a passthrough, so a
 * route can never publish a partially-attested restore.
 */
export const cmsEditorialRestorePort =
  (
    caller: (
      input: CmsEditorialPortInput,
      signal: AbortSignal,
    ) => Promise<CmsEditorialProductionResult<unknown>>,
  ): ((
    input: CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialProductionResult<CmsEditorialRestorePortValue>>) =>
  async (input, signal) => {
    const result = await caller(input, signal);
    if (!result.ok) return result;
    if (!isRecord(result.value)) return invalidResponse();
    const resource = EntryRevisionResourceSchema.safeParse(
      result.value.resource,
    );
    const evidence = RevisionRestoreVerificationSchema.safeParse(
      result.value.restoreVerification,
    );
    if (!resource.success || !evidence.success) return invalidResponse();
    return {
      ok: true,
      value: {
        resource: resource.data,
        restoreVerification: evidence.data,
      },
      ...(result.replayed === true ? { replayed: true as const } : {}),
    };
  };

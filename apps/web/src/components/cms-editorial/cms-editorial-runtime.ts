import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  CmsEditorialEntryRevisionRequestSchema,
  CmsEditorialEntryRevisionResourceSchema,
  type CmsEditorialEntryRevisionRequest,
  type CmsEditorialEntryRevisionResource,
} from './cms-editorial-contracts';
import {
  cmsEditorialVerifiedMutationErrorFrom,
  type CmsEditorialMutationOutcome,
} from './cms-editorial-mutation-errors';
import type { CmsEditorialEntryDraft } from './cms-editorial-types';

// The status/outcome mapping lives in cms-editorial-mutation-errors.ts; it is
// re-exported here so every existing importer keeps one runtime entry point.
export {
  cmsEditorialErrorCodeFrom,
  cmsEditorialErrorDetailsFrom,
  cmsEditorialOutcomeForStatus,
  cmsEditorialRetryAfterSecondsFrom,
  cmsEditorialVerifiedMutationErrorFrom,
  type CmsEditorialMutationOutcome,
} from './cms-editorial-mutation-errors';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialMutationResult {
  readonly outcome: CmsEditorialMutationOutcome;
  readonly status: number | null;
  readonly retryable: boolean;
  /** True when the request may have been applied but could not be confirmed. */
  readonly outcomeUnknown: boolean;
  readonly resource: CmsEditorialEntryRevisionResource | null;
  readonly errorCode: string | null;
  readonly errorDetails: readonly string[];
  /** A verified typed reason token (closed vocabulary), else null. */
  readonly reasonCode: string | null;
  readonly retryAfterSeconds: number | null;
}

/**
 * Parse an authoritative 201 body. A response only becomes `success` when the
 * body is a strict `EntryRevisionResource` for the entry that was saved.
 */
const authoritativeResourceFrom = async (
  response: Response,
  entryId: string,
): Promise<CmsEditorialEntryRevisionResource | null> => {
  if (response.status !== 201) return null;
  try {
    const parsed = CmsEditorialEntryRevisionResourceSchema.safeParse(
      await response.clone().json(),
    );
    if (!parsed.success) return null;
    return parsed.data.entryId === entryId ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * Submit one immutable revision. Autosave never publishes
 * (BE03b:94, IA03:37).
 */
export const executeCmsEditorialRevisionMutation = async (input: {
  readonly path: string;
  readonly request: CmsEditorialEntryRevisionRequest;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly fetcher?: Fetcher;
}): Promise<CmsEditorialMutationResult> => {
  const local = CmsEditorialEntryRevisionRequestSchema.safeParse(input.request);
  if (!local.success)
    return {
      outcome: 'validation',
      status: null,
      retryable: false,
      outcomeUnknown: false,
      resource: null,
      errorCode: 'VALIDATION_FAILED',
      errorDetails: local.error.issues.map((issue) => issue.path.join('/')),
      reasonCode: null,
      retryAfterSeconds: null,
    };
  const baseFetcher = input.fetcher ?? fetch;
  const fetcher: Fetcher = async (request, init) =>
    baseFetcher(request, await addClientBindingIdHeader(request, init));
  let response: Response;
  try {
    response = await fetcher(input.path, {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': input.csrfToken,
        'idempotency-key': input.idempotencyKey,
        'if-match': '"' + input.request.expectedVersion + '"',
      },
      body: JSON.stringify(input.request),
    });
  } catch {
    return {
      outcome: 'unknown',
      status: null,
      retryable: true,
      outcomeUnknown: true,
      resource: null,
      errorCode: null,
      errorDetails: [],
      reasonCode: null,
      retryAfterSeconds: null,
    };
  }
  const resource = await authoritativeResourceFrom(
    response,
    input.request.entryId,
  );
  if (resource !== null)
    return {
      outcome: 'success',
      status: 201,
      retryable: false,
      outcomeUnknown: false,
      resource,
      errorCode: null,
      errorDetails: [],
      reasonCode: null,
      retryAfterSeconds: null,
    };
  if (response.status === 201)
    return {
      outcome: 'unknown',
      status: 201,
      retryable: true,
      outcomeUnknown: true,
      resource: null,
      errorCode: null,
      errorDetails: [],
      reasonCode: null,
      retryAfterSeconds: null,
    };
  const mapped = await cmsEditorialVerifiedMutationErrorFrom(response);
  if (mapped === null)
    return {
      outcome: 'unknown',
      status: response.status,
      retryable: response.status >= 400,
      outcomeUnknown: true,
      resource: null,
      errorCode: null,
      errorDetails: [],
      reasonCode: null,
      retryAfterSeconds: null,
    };
  return {
    outcome: mapped.outcome,
    status: response.status,
    retryable: mapped.retryable,
    outcomeUnknown: mapped.outcome === 'unknown',
    resource: null,
    errorCode: mapped.errorCode,
    errorDetails: mapped.errorDetails,
    reasonCode: mapped.reasonCode,
    retryAfterSeconds: mapped.retryAfterSeconds,
  };
};

/**
 * Adopt the authoritative revision as the next autosave base. `baseRevision`
 * is the new revision number and `expectedVersion` is the committed ENTRY
 * version (`entryVersion`), so the next autosave is CAS-valid. The resource's
 * own `version` is the immutable snapshot's version (always 1) and is never an
 * If-Match operand.
 */
export const applyCmsEditorialAcceptedRevision = (
  draft: CmsEditorialEntryDraft,
  resource: CmsEditorialEntryRevisionResource,
): CmsEditorialEntryDraft => ({
  ...draft,
  baseRevision: resource.revisionNumber,
  expectedVersion: resource.entryVersion,
});

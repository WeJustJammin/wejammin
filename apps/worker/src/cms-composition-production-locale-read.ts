import {
  LocaleVariantReadApiRequestSchema,
  LocaleVariantReadSchema,
  localeVariantReadAnswers,
} from '@wejammin/contracts';

import type {
  CmsLocaleDependencies,
  CmsLocaleResult,
} from './cms-composition/locale-routes';
import { mapCmsCompositionRpcFailure } from './cms-composition-production-failure';
import {
  invalidResponse,
  unavailable,
} from './cms-editorial-production-errors';
import {
  cmsEditorialContextFor,
  correlationFor,
} from './cms-editorial-production-session';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

const RPC = 'cms_get_locale_variant';

/** The statuses BE03c leaves a bounded read: 409 and 422 are "not applicable", so a platform raise that maps there is a contract failure. */
const READ_STATUSES: ReadonlySet<number> = new Set([
  400, 401, 403, 404, 415, 429, 500, 502, 503, 504,
]);

const scrubbed = (): CmsLocaleResult<never> => ({
  ok: false,
  status: 500,
  code: 'INTERNAL_ERROR',
  message: 'The locale read failed.',
});

/**
 * `cmsLocaleVariantRead` RPC failure to port refusal. The read raises the generic BE03b tokens only; the 403 its
 * authority helper raises (`FORBIDDEN`) is the one typed refusal the read publishes, `capability_missing`
 * (CMS_SLICE_12_OPERATION_REASONS). A refusal that lands on a write-only status (a version or idempotency conflict, a
 * validation failure, a chain mismatch) and every untyped provider fault is a scrubbed 500.
 */
export const localeReadRpcError = (
  status: number,
  payload: unknown,
): CmsLocaleResult<never> => {
  const mapped = mapCmsCompositionRpcFailure(status, payload);
  if (!READ_STATUSES.has(mapped.status)) return scrubbed();
  return mapped.status === 403
    ? { ...mapped, details: { reasonCode: 'capability_missing' } }
    : mapped;
};

/**
 * `cmsLocaleVariantRead` production port (DEC-205). The Worker alone selects the private-schema RPC with the service
 * credential; the browser never supplies it. The database re-proves, whatever the Worker admitted, that the caller can
 * see the entry (404 otherwise), holds an author or editor assignment on it (403) and that the locale is one the
 * active schema version supports (404). The answer must be the strict `LocaleVariantRead` of this very entry and
 * locale; anything else is an invalid dependency answer.
 */
export const createLocaleVariantReader =
  (
    configuration: CmsEditorialProductionConfiguration,
    contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
    deadlineMs: number,
    maxResponseBytes: number,
  ): CmsLocaleDependencies['readLocaleVariant'] =>
  async (input, signal) => {
    if (input.operationId !== 'cmsLocaleVariantRead')
      return { ...scrubbed(), status: 400, code: 'INVALID_REQUEST' };
    const path = LocaleVariantReadApiRequestSchema.safeParse(input.path);
    if (!path.success)
      return { ...scrubbed(), status: 400, code: 'INVALID_REQUEST' };
    // The contract admits upper-case hex UUIDs; the database accepts lower-case only (cms_valid_uuid).
    const entryId = path.data.entryId.toLowerCase();
    const locale = path.data.locale;
    if (
      input.session.actingPartyId === null ||
      !input.session.capabilities.some(
        (value) => value === 'cms.author' || value === 'cms.editor',
      )
    )
      return {
        ...scrubbed(),
        status: 403,
        code: 'LOCALE_FORBIDDEN',
        details: { reasonCode: 'capability_missing' },
      };
    const context = cmsEditorialContextFor(input, contexts, configuration.now);
    if (
      context.authUserId !== input.session.userId ||
      context.actingPartyId !== input.session.actingPartyId
    )
      return { ...scrubbed(), status: 401, code: 'UNAUTHENTICATED' };
    const deadline = createDeadline(signal, deadlineMs);
    const timedOut = (): CmsLocaleResult<never> => ({
      ok: false,
      status: 504,
      code: 'DEADLINE',
      message: 'Deadline exceeded.',
      retryAfterSeconds: 15,
    });
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/${RPC}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
            'X-Operation-Id': 'cmsLocaleVariantRead',
            'X-Request-Id': input.requestId,
            'X-Correlation-Id': correlationFor(input),
          },
          body: JSON.stringify({
            p_request: {
              entryId,
              locale,
              context,
              correlationId: correlationFor(input),
            },
          }),
        },
        deadline,
      );
      if (!response.ok) return response;
      if (!response.value.ok) {
        const payload = await readRpcError(
          response.value,
          maxResponseBytes,
          deadline.signal,
        );
        return deadline.expired()
          ? timedOut()
          : localeReadRpcError(response.value.status, payload);
      }
      const parsed = await parseJsonResponse(
        response.value,
        maxResponseBytes,
        deadline.signal,
      );
      if (deadline.expired()) return timedOut();
      if (!parsed.ok) return parsed;
      const read = LocaleVariantReadSchema.safeParse(parsed.value);
      return read.success &&
        localeVariantReadAnswers(read.data, entryId, locale)
        ? { ok: true, value: read.data }
        : invalidResponse();
    } catch {
      return unavailable('cms_composition');
    } finally {
      deadline.dispose();
    }
  };

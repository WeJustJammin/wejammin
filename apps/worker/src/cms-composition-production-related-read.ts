import { RelatedContentReadApiRequestSchema } from '@wejammin/contracts';

import { validRuleRead } from './cms-composition/related-content-envelope';
import { failure } from './cms-composition/related-content-response';
import type { CmsRelatedContentDependencies } from './cms-composition/related-content-routes';
import { relatedReadRpcError } from './cms-composition-production-related-rpc';
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

const RPC = 'cms_get_related_content';

/**
 * `cmsRelatedContentRead` production port (DEC-195). The Worker alone selects the private-schema RPC with the service
 * credential; the browser never supplies it. The database re-proves, whatever the Worker admitted, that the caller
 * can see the source (404 otherwise) and holds an author or editor assignment on it (403 `capability_missing`).
 * The answer must be the strict `{ rule }` of this very entry; anything else is an invalid dependency answer.
 */
export const createRelatedContentReader =
  (
    configuration: CmsEditorialProductionConfiguration,
    contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
    deadlineMs: number,
    maxResponseBytes: number,
  ): CmsRelatedContentDependencies['readRelatedContent'] =>
  async (input, signal) => {
    if (input.operationId !== 'cmsRelatedContentRead') return failure(400);
    const path = RelatedContentReadApiRequestSchema.safeParse(input.path);
    if (!path.success) return failure(400);
    // The contract admits upper-case hex UUIDs; the database accepts lower-case only (cms_valid_uuid).
    const entryId = path.data.entryId.toLowerCase();
    if (
      input.session.actingPartyId === null ||
      !input.session.capabilities.some(
        (value) => value === 'cms.author' || value === 'cms.editor',
      )
    )
      return failure(403, { reasonCode: 'capability_missing' });
    const context = cmsEditorialContextFor(input, contexts, configuration.now);
    if (
      context.authUserId !== input.session.userId ||
      context.actingPartyId !== input.session.actingPartyId
    )
      return failure(401);
    const deadline = createDeadline(signal, deadlineMs);
    const timedOut = () => failure(504, {}, 15);
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
            'X-Operation-Id': 'cmsRelatedContentRead',
            'X-Request-Id': input.requestId,
            'X-Correlation-Id': correlationFor(input),
          },
          body: JSON.stringify({
            p_request: {
              entryId,
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
          : relatedReadRpcError(response.value.status, payload);
      }
      const parsed = await parseJsonResponse(
        response.value,
        maxResponseBytes,
        deadline.signal,
      );
      if (deadline.expired()) return timedOut();
      if (!parsed.ok) return parsed;
      return validRuleRead(parsed.value, entryId)
        ? { ok: true, value: parsed.value }
        : invalidResponse();
    } catch {
      return unavailable('cms_composition');
    } finally {
      deadline.dispose();
    }
  };

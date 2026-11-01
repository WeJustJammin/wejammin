import { CmsUuidSchema } from '@wejammin/contracts';
import { correlationFor } from './cms-editorial-production-session';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
} from './cms-editorial-production-transport';
import type { CmsEditorialProductionConfiguration } from './cms-editorial-production-types';
import { supabaseRpcHeaders } from './supabase-rpc-headers';
import { isRecord } from './cms-editorial-production-errors';
import { taxonomyRpcFailure } from './cms-composition/taxonomy-definition-response';
import { TAXONOMY_RPC } from './cms-composition/taxonomy-rpc-table';
import {
  TAXONOMY_BYTES,
  failure,
  validVersions,
  type CmsTaxonomyDefinitionDependencies,
  type CmsTaxonomyDefinitionResult,
  type TaxonomyBaseInput,
} from './cms-composition/taxonomy-definition-shared';

export type TaxonomyContextVerifier = (
  input: TaxonomyBaseInput,
  signal: AbortSignal,
) => Promise<CmsTaxonomyDefinitionResult<Readonly<Record<string, unknown>>>>;
export type TaxonomyRpc = <T>(
  input: TaxonomyBaseInput,
  payload: Readonly<Record<string, unknown>>,
  validate: (value: unknown) => value is T,
  signal: AbortSignal,
) => Promise<CmsTaxonomyDefinitionResult<T>>;

/** Named transport only. No mutation retry; one deadline owns headers and body. */
export const createTaxonomyDefinitionRpc =
  (
    configuration: CmsEditorialProductionConfiguration,
    verify: TaxonomyContextVerifier,
    deadlineMs: number,
  ): TaxonomyRpc =>
  async (input, payload, validate, signal) => {
    const operation = input.operationId;
    const spec = Object.hasOwn(TAXONOMY_RPC, operation)
      ? TAXONOMY_RPC[operation]
      : undefined;
    if (spec === undefined) return failure(400);
    const write = spec.write;
    const deadline = createDeadline(
      signal,
      Math.min(deadlineMs, spec.deadlineMs),
    );
    let response: Response | undefined;
    let removeVerifyListener = () => {};
    try {
      if (deadline.signal.aborted) return failure(504, {}, 5);
      const context = await new Promise<
        Awaited<ReturnType<TaxonomyContextVerifier>>
      >((resolve) => {
        const abort = () => resolve(failure(504, {}, 5));
        deadline.signal.addEventListener('abort', abort, { once: true });
        removeVerifyListener = () =>
          deadline.signal.removeEventListener('abort', abort);
        void verify(input, deadline.signal).then(resolve, () =>
          resolve(failure(503, {}, 5)),
        );
      });
      removeVerifyListener();
      if (!context.ok) return context;
      if (deadline.signal.aborted) return failure(504, {}, 5);
      const correlationId = correlationFor(input);
      const body = JSON.stringify({
        p_request: { ...payload, context: context.value, correlationId },
      });
      if (new TextEncoder().encode(body).byteLength > TAXONOMY_BYTES)
        return failure(400);
      const headers = new Headers({
        Accept: 'application/json',
        'Accept-Profile': 'platform_api',
        ...supabaseRpcHeaders(configuration.secret),
        'Content-Profile': 'platform_api',
        'Content-Type': 'application/json',
        'X-Operation-Id': operation,
        'X-Request-Id': input.requestId,
        'X-Correlation-Id': correlationId,
      });
      if (write && typeof payload.idempotencyKey === 'string')
        headers.set('X-Idempotency-Key', payload.idempotencyKey);
      if (write && typeof payload.ifMatch === 'string')
        headers.set('If-Match', `"${payload.ifMatch}"`);
      const transport = await fetchWithDeadline(
        {
          ...configuration,
          fetchImpl: async (url, init) => {
            const result = await configuration.fetchImpl(url, init);
            if (deadline.signal.aborted)
              void result.body?.cancel().catch(() => undefined);
            return result;
          },
        },
        `${configuration.baseUrl}/rest/v1/rpc/${spec.rpc}`,
        { method: 'POST', headers, body },
        deadline,
      );
      if (!transport.ok)
        return failure(transport.status, {}, transport.retryAfterSeconds);
      response = transport.value;
      const parsed = await parseJsonResponse(
        response,
        configuration.maxResponseBytes,
        deadline.signal,
      );
      if (deadline.signal.aborted) return failure(504, {}, 5);
      if (!parsed.ok) return failure(502);
      if (!response.ok)
        return taxonomyRpcFailure(response.status, parsed.value, operation);
      if (
        !validate(parsed.value) ||
        new TextEncoder().encode(JSON.stringify(parsed.value)).byteLength >
          configuration.maxResponseBytes
      )
        return failure(502);
      return { ok: true, value: parsed.value };
    } catch {
      return deadline.signal.aborted
        ? failure(504, {}, 5)
        : failure(503, {}, 5);
    } finally {
      removeVerifyListener();
      if (
        response?.body !== null &&
        response?.body !== undefined &&
        !response.bodyUsed
      )
        void response.body.cancel().catch(() => undefined);
      deadline.dispose();
    }
  };

export const createTaxonomyDefinitionVersionsReader =
  (rpc: TaxonomyRpc): CmsTaxonomyDefinitionDependencies['readVersions'] =>
  async (input, signal) => {
    const url = new URL(input.request.url);
    if (
      input.operationId !== 'cmsTaxonomyVersionsRead' ||
      !CmsUuidSchema.safeParse(input.taxonomyId).success ||
      input.request.method !== 'GET' ||
      url.pathname !== `/api/v1/cms/taxonomies/${input.taxonomyId}/versions` ||
      url.search !== '' ||
      input.request.headers.has('if-match') ||
      input.request.headers.has('idempotency-key') ||
      input.request.headers.has('content-type') ||
      input.request.body !== null ||
      input.request.headers.has('transfer-encoding') ||
      (input.request.headers.has('content-length') &&
        input.request.headers.get('content-length') !== '0')
    )
      return failure(400);
    // Private producer witness distinguishes a visible empty lineage from absence.
    const result = await rpc(
      input,
      { taxonomyId: input.taxonomyId },
      (
        value,
      ): value is {
        taxonomyId: string;
        page: import('@wejammin/contracts').TaxonomyVersionsPage;
      } =>
        isRecord(value) &&
        Object.keys(value).length === 2 &&
        value.taxonomyId === input.taxonomyId &&
        validVersions(value.page, input.taxonomyId),
      signal,
    );
    return result.ok ? { ok: true, value: result.value.page } : result;
  };

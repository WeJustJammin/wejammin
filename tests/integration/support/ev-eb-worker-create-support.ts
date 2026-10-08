import {
  IDEMPOTENCY_KEY,
  ORIGIN,
  fetchFailing,
  wiredApp,
} from '../../../apps/worker/src/cms-editorial-production-app.test-support';
import { ok } from '../../../apps/worker/src/cms-editorial-production-telemetry.test-support';
import {
  REQUEST_ID,
  captureInit,
} from '../../../apps/worker/src/cms-editorial-production.test-support';
import {
  createBody,
  createPath,
  createResource,
} from '../../../apps/worker/src/cms-editorial/route-fixtures.test-support';

/**
 * Evidence lane EB, writer W3a: CMS-03B-10 (initial entry create) through the real
 * route composition `createCmsEditorialApp(createProductionCmsEditorialDependencies(...))`
 * with only the PostgREST fetch (and the session/rate seams) faked. Criteria:
 * AC-062 (bounds), AC-063 (derivation, capability), AC-065 (error mapping), AC-066
 * (redacted telemetry).
 */

export const NEW_ENTRY_ID = '71000000-0000-4000-8000-0000000000a1';
export const NEW_REVISION_ID = '72000000-0000-4000-8000-0000000000a2';
export const SESSION_USER = '73000000-0000-4000-8000-0000000000a3';
export const SESSION_PARTY = '74000000-0000-4000-8000-0000000000a4';
export const TITLE = 'EB confidential working title';
export const created = {
  ...createResource,
  entry: { ...createResource.entry, id: NEW_ENTRY_ID },
  revision: { ...createResource.revision, id: NEW_REVISION_ID },
};

export type App = ReturnType<typeof wiredApp>;
export type Capabilities = readonly string[];

export const sessionOf = (capabilities: Capabilities) => async () => ({
  ok: true as const,
  value: {
    userId: SESSION_USER,
    actingPartyId: SESSION_PARTY,
    capabilities,
    mfaFresh: true,
  },
});

export const send = async (
  app: App,
  init: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> =>
  app.request(createPath, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': IDEMPOTENCY_KEY,
      'x-request-id': REQUEST_ID,
      ...init.headers,
    },
    body: JSON.stringify(init.body ?? createBody),
  });

export const rpcRequest = (fetchImpl: ReturnType<typeof fetchFailing>) =>
  JSON.parse(String(captureInit(fetchImpl).init.body)) as {
    p_request: Record<string, unknown> & { context: Record<string, unknown> };
  };

export const appOk = (capabilities: Capabilities = ['cms.author']) => {
  const fetchImpl = fetchFailing(ok(created));
  return {
    fetchImpl,
    app: wiredApp(fetchImpl, { resolveSession: sessionOf(capabilities) }),
  };
};

export const failing = (response: () => Response) => {
  const fetchImpl = fetchFailing(response);
  return { fetchImpl, app: wiredApp(fetchImpl) };
};

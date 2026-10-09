import { vi } from 'vitest';

import {
  createCmsEditorialApp,
  type CmsEditorialDependencies,
} from './cms-editorial';
import { cleanInput } from './cms-editorial/a11y-structural/a11y-structural.test-support';
import {
  approvedReviewResource,
  assignmentResource,
  previewResource,
  publicationResource,
  queuePage,
  reviewDetailResource,
  reviewResource,
  scheduleResource,
  workflowResource,
} from './cms-editorial/workflow-fixtures.test-support';
import { ORIGIN, rateSeam } from './cms-editorial-production-app.test-support';
import {
  PARTY_ID,
  USER_ID,
  compose,
  json,
} from './cms-editorial-production.test-support';

/**
 * Whole-app fixtures for the Slice 11 production adapter: the real Hono routes
 * over the real production adapter and quality gate, with only the PostgREST
 * network edge (`fetchImpl`) and the session/rate seams faked.
 */

export { ORIGIN };

/** A session that holds every editorial capability and a fresh MFA proof. */
export const fullSession = async () => ({
  ok: true as const,
  value: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author', 'cms.editor', 'cms.reviewer', 'cms.publisher'],
    mfaFresh: true,
  },
});

/** The success resource the faked RPC answers for each Slice 11 operation. */
export const workflowResources: Readonly<Record<string, unknown>> = {
  'CMS-03B-05': reviewResource,
  'CMS-03B-06': approvedReviewResource,
  'CMS-03B-07': scheduleResource,
  'CMS-03B-08': previewResource,
  'CMS-03B-09': publicationResource,
  'CMS-03B-15': workflowResource,
  'CMS-03B-16': reviewDetailResource,
  'CMS-03B-17': queuePage,
  'CMS-03B-18': assignmentResource,
};

/** The checker input the faked quality-gate load answers (a healthy revision). */
export const gateInput = cleanInput();

export type RpcCall = Readonly<{
  name: string;
  headers: Record<string, string>;
  request: Record<string, unknown>;
}>;

type RpcHandler = (call: RpcCall) => Response | Promise<Response>;

/**
 * A PostgREST edge keyed by RPC name. The default quality-gate load answers the
 * healthy checker input; every call is recorded in order.
 */
export const rpcEdge = (handlers: Readonly<Record<string, RpcHandler>>) => {
  const calls: RpcCall[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const name = String(url).split('/rpc/')[1] as string;
    const call: RpcCall = {
      name,
      headers: init.headers as Record<string, string>,
      request: (
        JSON.parse(String(init.body)) as { p_request: Record<string, unknown> }
      ).p_request,
    };
    calls.push(call);
    const handler =
      handlers[name] ??
      (name === 'cms_load_quality_gate_input'
        ? () => json(gateInput)
        : undefined);
    if (handler === undefined) throw new Error(`no handler for ${name}`);
    return handler(call);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};

export const workflowApp = (
  fetchImpl: typeof fetch,
  overrides: Record<string, unknown> = {},
) =>
  createCmsEditorialApp(
    compose(fetchImpl, {
      resolveSession: fullSession,
      rateLimit: rateSeam,
      telemetry: async () => undefined,
      ...overrides,
    }) as unknown as CmsEditorialDependencies,
  );

/** A raised PostgREST refusal whose machine DETAIL is a JSON object. */
export const raised = (message: string, detail?: unknown): Response =>
  json(
    {
      code: 'P0001',
      details: detail === undefined ? null : JSON.stringify(detail),
      hint: null,
      message,
    },
    400,
  );

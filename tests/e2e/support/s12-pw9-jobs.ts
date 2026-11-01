/**
 * The two system jobs the real-route harness has no consumer for, run through the PRODUCTION `platform_api` RPCs as the
 * Worker service credential, exactly as the Worker's queue consumers call them (Kong -> PostgREST -> SQL):
 *
 *  - `cms.governed_review.recheck` (BE03c "Invalidation", "Job transport"): the producer rereads the committed
 *    `cms.pattern.activated.v1` event (`cms_governed_recheck_resolve_event`) and the job runs one bounded step
 *    (`cms_recheck_governed_reviews`), with `{ eventId, kind, refId, cursor }` as the message names them.
 *  - `cms.pattern.linked_update_scan` (BE03c "Linked update", "Job transport"): the job runs one bounded step
 *    (`cms_scan_linked_pattern_updates`) with `{ patternId, patternVersionId, cursor, correlationId }`.
 *
 * Why a stand-in: `run-s09-real-servers.mjs` starts the API Worker and the web server only. Nothing relays the outbox to the
 * platform queue and nothing consumes it, so without these calls the events the activation committed are never processed.
 * Both RPCs are granted to `service_role` alone and appear in no browser route (`linked-scan/rpc-names.ts`,
 * `governed-recheck/rpc-names.ts`); this is the only way a test reaches them. Not type-checked by `pnpm type-check`.
 */
import { randomUUID } from 'node:crypto';

import { callRpc, psql, tokenFor } from '../../postgrest/support/stack';
import { uuid } from './s12-pw9-world';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** The id of the committed `cms.pattern.activated.v1` event that names `patternVersionId`. */
export const activationEventId = async (
  patternVersionId: string,
): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const found = psql(
      `select id from platform_private.outbox_events
        where event_type = 'cms.pattern.activated.v1' and payload->>'patternVersionId' = '${uuid(patternVersionId)}'
        order by occurred_at desc limit 1`,
    );
    if (found !== '') return found;
    await sleep(500);
  }
  throw new Error(
    `No cms.pattern.activated.v1 event names version ${patternVersionId}.`,
  );
};

const answerOf = (
  label: string,
  outcome: Awaited<ReturnType<typeof callRpc>>,
): Record<string, unknown> => {
  if (
    outcome.status !== 200 ||
    typeof outcome.body !== 'object' ||
    outcome.body === null
  )
    throw new Error(
      `${label} answered ${String(outcome.status)} ${outcome.code} ${outcome.message}`,
    );
  return outcome.body as Record<string, unknown>;
};

export type RecheckRun = Readonly<{
  examined: number;
  invalidated: number;
  dependencyChanged: number;
  reviewerAuthorityChanged: number;
  unavailable: number;
  nextCursor: string | null;
}>;

/**
 * One whole `cms.governed_review.recheck` run for the activation of `patternVersionId`: resolve the committed event to the
 * dependency it names (`kind` pattern), then run the job from the start. A run that leaves a cursor is continued.
 */
export const runGovernedRecheck = async (
  patternVersionId: string,
): Promise<RecheckRun> => {
  const token = tokenFor('service_role');
  const eventId = await activationEventId(patternVersionId);
  const resolved = answerOf(
    'cms_governed_recheck_resolve_event',
    await callRpc('cms_governed_recheck_resolve_event', token, {
      p_event_id: eventId,
    }),
  );
  if (resolved.found !== true)
    throw new Error('The activation event resolves to no dependency.');
  const total = {
    examined: 0,
    invalidated: 0,
    dependencyChanged: 0,
    reviewerAuthorityChanged: 0,
    unavailable: 0,
  };
  let cursor: string | null = null;
  for (let step = 0; step < 20; step += 1) {
    const run = answerOf(
      'cms_recheck_governed_reviews',
      await callRpc('cms_recheck_governed_reviews', token, {
        p_request: {
          eventId,
          kind: resolved.kind,
          refId: resolved.refId,
          cursor,
        },
      }),
    );
    total.examined += Number(run.examined);
    total.invalidated += Number(run.invalidated);
    total.dependencyChanged += Number(run.dependencyChanged);
    total.reviewerAuthorityChanged += Number(run.reviewerAuthorityChanged);
    total.unavailable += Number(run.unavailable);
    cursor = typeof run.nextCursor === 'string' ? run.nextCursor : null;
    if (cursor === null) break;
  }
  return { ...total, nextCursor: cursor };
};

export type ScanRun = Readonly<{
  examined: number;
  appended: number;
  nextCursor: string | null;
}>;

/** One whole `cms.pattern.linked_update_scan` run for the activation of `patternVersionId` of `patternId`. */
export const runLinkedScan = async (
  patternId: string,
  patternVersionId: string,
): Promise<ScanRun> => {
  const token = tokenFor('service_role');
  const total = { examined: 0, appended: 0 };
  let cursor: string | null = null;
  for (let step = 0; step < 20; step += 1) {
    const run = answerOf(
      'cms_scan_linked_pattern_updates',
      await callRpc('cms_scan_linked_pattern_updates', token, {
        p_request: {
          patternId: uuid(patternId),
          patternVersionId: uuid(patternVersionId),
          cursor,
          correlationId: randomUUID(),
        },
      }),
    );
    total.examined += Number(run.examined);
    total.appended += Number(run.appended);
    cursor = typeof run.nextCursor === 'string' ? run.nextCursor : null;
    if (cursor === null) break;
  }
  return { ...total, nextCursor: cursor };
};

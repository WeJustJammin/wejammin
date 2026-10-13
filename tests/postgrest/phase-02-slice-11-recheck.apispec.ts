/**
 * Real dependency-recheck composition (BE03b "Review invalidation / Dependency recheck";
 * tracker P2-S11-AC-113): a genuine successor schema activation leads, through the real
 * outbox relay, the production queue entrypoint, the real source-event consumer and the real
 * `cms.review.dependency_recheck` job, to the invalidation of the live reviews that froze the
 * superseded version.
 *
 * Everything runs for real over the local PostgREST stack: the schema lifecycle and the
 * reviews are produced through the public CMS routes, the relay is the Worker's scheduled
 * outbox sweep (`claim_outbox_batch` / `complete_outbox_event`), the consumer and the job
 * call the protected `platform_api` RPCs. Only Cloudflare Queues is replaced, by an in-memory
 * loopback that records what the Worker sends and hands messages back one at a time.
 */
import { randomUUID } from 'node:crypto';

import {
  ReviewDependencyRecheckMessageSchema,
  ReviewRecheckSourceEnvelopeSchema,
} from '@wejammin/contracts';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsMessage,
} from '../../apps/worker/src/async-entrypoint';
import { createProductionAsyncEntrypoint } from '../../apps/worker/src/production-async-entrypoint';
import {
  approvedDraft,
  assignReviewer,
  decide,
  submitForReview,
  type ReviewedDraft,
} from './support/phase-02-slice-11-flow';
import {
  activateS11SchemaCandidate,
  prepareS11SchemaCandidate,
} from './support/phase-02-slice-11-schema-lifecycle';
import {
  deadLetters,
  editedSourceFixture,
  localeVariantFixture,
  outboxDisposition,
  seedPoisonHistory,
  type PoisonRow,
} from './support/phase-02-slice-11-recheck-fixtures';
import { createS11Stack } from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  seedDraft,
  type S11World,
} from './support/phase-02-slice-11-world';
import {
  API_URL,
  ensureCmsOwner,
  psql,
  workerServiceCredential,
} from './support/stack';

type Exchange = Readonly<{
  rpc: string;
  request: unknown;
  response: unknown;
  status: number;
}>;

const RESOLVE_RPC = 'cms_dependency_recheck_resolve_event';
const RUN_RPC = 'cms_dependency_recheck_run';
const RECHECK_RPCS = new Set([RESOLVE_RPC, RUN_RPC]);
const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;

const exchanges: Exchange[] = [];
const queued: unknown[] = [];
const tracedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url = String(input instanceof Request ? input.url : input);
  const rpc = /\/rpc\/([a-z0-9_]+)$/u.exec(url)?.[1];
  if (rpc !== undefined && RECHECK_RPCS.has(rpc))
    exchanges.push({
      rpc,
      request: JSON.parse(String(init?.body ?? '{}')) as unknown,
      response: (await response.clone().json()) as unknown,
      status: response.status,
    });
  return response;
};
const environment = {
  APP_ENVIRONMENT: 'development',
  APP_RELEASE: 'slice-11-recheck',
  PLATFORM_JOBS: {
    send: async (body: unknown): Promise<void> => {
      queued.push(JSON.parse(JSON.stringify(body)) as unknown);
    },
  },
  SUPABASE_SECRET_KEY: workerServiceCredential(),
  SUPABASE_URL: API_URL,
} as unknown as AsyncWorkerBindings;
const entrypoint = createProductionAsyncEntrypoint(tracedFetch);

/** One delivery of a message to the production queue handler. */
const deliver = async (body: unknown, attempts = 1) => {
  const message = {
    ack: vi.fn(),
    retry: vi.fn(),
    attempts,
    body,
    id: randomUUID(),
  } satisfies PlatformJobsMessage;
  await entrypoint.queue(
    { messages: [message], queue: 'platform-jobs' },
    environment,
    executionContext,
  );
  return message;
};

/** Ticks the real outbox sweep until the relay has placed the event on the queue. */
const relay = async (eventId: string): Promise<Record<string, unknown>> => {
  for (let tick = 0; tick < 120; tick += 1) {
    await entrypoint.scheduled(
      { cron: '* * * * *', scheduledTime: Date.now() },
      environment,
      executionContext,
    );
    const found = queued.find(
      (body) => (body as { eventId?: string }).eventId === eventId,
    );
    if (found !== undefined) return found as Record<string, unknown>;
  }
  throw new Error('the outbox relay never reached the activation event');
};

const reviewState = (reviewId: string): string =>
  psql(`select state || '/' || coalesce(invalidated_reason, '-') || '/' || version::text
    from platform_private.cms_editorial_reviews where id = '${reviewId}'`);
const reviewEvents = (reviewId: string, correlationId?: string): number =>
  Number(
    psql(`select count(*) from platform_private.outbox_events
    where event_type = 'cms.entry.review-changed.v1' and aggregate_id = '${reviewId}'
      ${correlationId === undefined ? '' : `and correlation_id = '${correlationId}'`}`),
  );
const dependencyRows = (reviewId: string): number =>
  Number(
    psql(`select count(*) from platform_private.cms_editorial_review_dependencies
    where review_id = '${reviewId}'`),
  );

let world: S11World;
let control: S11World;
let openReview: Readonly<{ id: string; version: number }>;
let approved: ReviewedDraft;
let controlReview: ReviewedDraft;
let supersededVersionId: string;
let activatedVersionId: string;
let activationEventId: string;
let activationCorrelationId: string;
let source: Record<string, unknown>;
let sourceMessage: PlatformJobsMessage;
let jobBodies: unknown[] = [];
let poison: readonly PoisonRow[] = [];
let beforeJob: Readonly<{ open: string; approved: string; control: string }>;
let dependenciesBefore: Readonly<{ open: number; approved: number }>;

beforeAll(async () => {
  poison = seedPoisonHistory();
  // Each world owns its type: the activation below supersedes `world`'s version, and `control`
  // must stay another, untouched content type (a shared type would be both).
  world = await prepareS11World({ fresh: true });
  control = await prepareS11World({ fresh: true });
  const stack = createS11Stack(world.owner);
  const draft = await seedDraft(stack, world, 'Recheck open review');
  const submitted = await submitForReview(stack, world, draft);
  openReview = { id: submitted.id, version: Number(submitted.version) };
  approved = await approvedDraft(stack, world, 'Recheck approved review');
  controlReview = await approvedDraft(
    stack,
    control,
    'Recheck control review (another content type)',
  );
  beforeJob = {
    open: reviewState(openReview.id),
    approved: reviewState(approved.reviewId),
    control: reviewState(controlReview.reviewId),
  };
  dependenciesBefore = {
    open: dependencyRows(openReview.id),
    approved: dependencyRows(approved.reviewId),
  };
  supersededVersionId = world.editorial.contentTypeVersionId;

  // The genuine activation of a successor version: the previous version is superseded in the
  // same transaction that commits cms.schema.activated.v1.
  const successor = await prepareS11SchemaCandidate(
    ensureCmsOwner(),
    world.editorial,
  );
  await activateS11SchemaCandidate(successor);
  activatedVersionId = successor.contentTypeVersionId;
  [activationEventId = '', activationCorrelationId = ''] = psql(
    `select id::text || '|' || correlation_id::text from platform_private.outbox_events
     where event_type = 'cms.schema.activated.v1' and aggregate_id = '${activatedVersionId}'`,
  ).split('|');
  expect(activationEventId).toMatch(/^[0-9a-f-]{36}$/u);
}, 600_000);

describe('[P2-S11-AC-113] the dependency recheck through the real relay, consumer, job and database', () => {
  it('leaves every review live until the recheck runs: the activation itself invalidates no editorial review', () => {
    expect(supersededVersionId).not.toBe(activatedVersionId);
    expect(
      psql(`select state from platform_private.cms_content_type_versions
      where id = '${supersededVersionId}'`),
    ).toBe('superseded');
    expect(beforeJob.open).toBe(`open/-/${openReview.version}`);
    expect(beforeJob.approved).toBe(`approved/-/${approved.reviewVersion}`);
    expect(reviewState(openReview.id)).toBe(beforeJob.open);
    expect(reviewState(approved.reviewId)).toBe(beforeJob.approved);
    expect(reviewState(controlReview.reviewId)).toBe(beforeJob.control);
  });

  it('relays the committed cms.schema.activated.v1 as an identifier-only envelope with its registered producer', async () => {
    source = await relay(activationEventId);
    expect(ReviewRecheckSourceEnvelopeSchema.parse(source)).toMatchObject({
      eventId: activationEventId,
      eventType: 'cms.schema.activated.v1',
      schemaVersion: 1,
      producer: 'cms.schema_registry',
      aggregateType: 'cms_content_type_version',
      aggregateId: activatedVersionId,
      correlationId: activationCorrelationId,
    });
    expect(Object.keys(source)).not.toContain('payload');
    expect(
      psql(`select (dispatched_at is not null)::text from platform_private.outbox_events
      where id = '${activationEventId}'`),
    ).toBe('true');
  }, 300_000);

  it('[P2-S11-AC-113] did not let two unparseable historical rows stop that relay: each is a recorded dead letter, finalized and never queued', () => {
    // B-05: the claim returned both rows first; the sweep recorded them (identifiers and the closed
    // reason only), completed their claims and went on to the activation event above.
    expect(poison).toHaveLength(2);
    for (const row of poison) {
      expect(deadLetters(row.id)).toBe(
        'platform.outbox.sweep/INVALID_QUEUE_PAYLOAD',
      );
      expect(outboxDisposition(row.id)).toBe('true/true');
      expect(
        queued.some(
          (body) => (body as { eventId?: string }).eventId === row.id,
        ),
      ).toBe(false);
    }
  });

  it('consumes the envelope: rereads the event and enqueues { eventId, kind, refId } for the activated version', async () => {
    const sent = queued.length;
    sourceMessage = await deliver(source);
    expect(sourceMessage.ack).toHaveBeenCalledOnce();
    expect(sourceMessage.retry).not.toHaveBeenCalled();
    expect(exchanges.filter((item) => item.rpc === RESOLVE_RPC)).toEqual([
      {
        rpc: RESOLVE_RPC,
        request: { p_event_id: activationEventId },
        response: { found: true, kind: 'schema', refId: activatedVersionId },
        status: 200,
      },
    ]);
    jobBodies = queued
      .slice(sent)
      .filter(
        (body) =>
          (body as { jobType?: string }).jobType ===
          'cms.review.dependency_recheck',
      );
    expect(jobBodies).toHaveLength(1);
    expect(ReviewDependencyRecheckMessageSchema.parse(jobBodies[0])).toEqual({
      jobType: 'cms.review.dependency_recheck',
      schemaVersion: 1,
      payload: {
        eventId: activationEventId,
        kind: 'schema',
        refId: activatedVersionId,
      },
      cursor: null,
      correlationId: activationCorrelationId,
    });
  });

  it('runs the job: both live reviews of the superseded version are invalidated dependency_changed and the control review is untouched', async () => {
    const job = await deliver(jobBodies[0]);
    expect(job.ack).toHaveBeenCalledOnce();
    expect(job.retry).not.toHaveBeenCalled();
    expect(exchanges.filter((item) => item.rpc === RUN_RPC)).toEqual([
      {
        rpc: RUN_RPC,
        request: {
          p_request: {
            eventId: activationEventId,
            kind: 'schema',
            refId: activatedVersionId,
            cursor: null,
          },
        },
        response: { examined: 2, invalidated: 2, nextCursor: null },
        status: 200,
      },
    ]);
    expect(reviewState(openReview.id)).toBe(
      `invalidated/dependency_changed/${openReview.version + 1}`,
    );
    expect(reviewState(approved.reviewId)).toBe(
      `invalidated/dependency_changed/${Number(approved.reviewVersion) + 1}`,
    );
    expect(reviewState(controlReview.reviewId)).toBe(beforeJob.control);
    expect(queued.at(-1)).not.toMatchObject({
      jobType: 'cms.review.dependency_recheck',
      cursor: expect.any(String),
    });
  });

  it('commits one review-changed event per invalidation carrying the correlation id of the activation, and retains the dependency index', () => {
    for (const [reviewId, version] of [
      [openReview.id, openReview.version + 1],
      [approved.reviewId, Number(approved.reviewVersion) + 1],
    ] as const) {
      expect(
        psql(`select count(*) from platform_private.outbox_events
        where event_type = 'cms.entry.review-changed.v1' and aggregate_id = '${reviewId}'
          and aggregate_version = ${version} and correlation_id = '${activationCorrelationId}'`),
      ).toBe('1');
      expect(
        psql(`select count(*) from audit_private.audit_events
        where action = 'cms.entry.review.invalidate' and target_id = '${reviewId}'
          and correlation_id = '${activationCorrelationId}'`),
      ).toBe('1');
    }
    expect(dependencyRows(openReview.id)).toBe(dependenciesBefore.open);
    expect(dependencyRows(approved.reviewId)).toBe(dependenciesBefore.approved);
    expect(dependenciesBefore.open).toBeGreaterThanOrEqual(2);
    expect(reviewEvents(controlReview.reviewId, activationCorrelationId)).toBe(
      0,
    );
  });

  it('is idempotent under redelivery: the same event again enqueues a job that finds nothing and changes nothing', async () => {
    const stateBefore = [
      reviewState(openReview.id),
      reviewState(approved.reviewId),
      reviewState(controlReview.reviewId),
    ];
    const eventsBefore = [
      reviewEvents(openReview.id),
      reviewEvents(approved.reviewId),
    ];
    const sent = queued.length;
    const again = await deliver(source, 2);
    expect(again.ack).toHaveBeenCalledOnce();
    const replay = queued
      .slice(sent)
      .filter(
        (body) =>
          (body as { jobType?: string }).jobType ===
          'cms.review.dependency_recheck',
      );
    expect(replay).toHaveLength(1);
    const job = await deliver(replay[0]);
    expect(job.ack).toHaveBeenCalledOnce();
    expect(
      exchanges.filter((item) => item.rpc === RUN_RPC).at(-1)?.response,
    ).toEqual({ examined: 0, invalidated: 0, nextCursor: null });
    expect([
      reviewState(openReview.id),
      reviewState(approved.reviewId),
      reviewState(controlReview.reviewId),
    ]).toEqual(stateBefore);
    expect([
      reviewEvents(openReview.id),
      reviewEvents(approved.reviewId),
    ]).toEqual(eventsBefore);
  });
});

describe('[P2-S11-AC-113] the localization recheck through the real relay, consumer, job and database', () => {
  let sourceRevisionId = '';
  let entryId = '';
  let variantRevisionId = '';
  let localeReview: Readonly<{ id: string; version: number }>;
  let localizationEventId = '';
  let localizationCorrelationId = '';
  let localizationEnvelope: Record<string, unknown>;
  let localizationJob: unknown;

  const exchangesOf = (rpc: string, eventId: string): readonly Exchange[] =>
    exchanges.filter((item) => {
      const request = item.request as {
        p_event_id?: string;
        p_request?: { eventId?: string };
      };
      return (
        item.rpc === rpc &&
        (request.p_event_id ?? request.p_request?.eventId) === eventId
      );
    });

  beforeAll(async () => {
    // `control` owns an untouched, still-active type (the first describe superseded `world`'s).
    const stack = createS11Stack(control.owner);
    const draft = await seedDraft(stack, control, 'Locale recheck source');
    sourceRevisionId = draft.revisionId;
    entryId = draft.entryId;
    variantRevisionId = randomUUID();
    const reviewId = randomUUID();
    psql(
      localeVariantFixture({
        sourceRevisionId,
        variantRevisionId,
        variantRowId: randomUUID(),
        reviewId,
        ownerPersonId: control.owner.personId,
        ownerAuthUserId: control.owner.authUserId,
      }),
    );
    await assignReviewer(stack, control, reviewId, '1');
    const approvedReview = await decide(stack, control, reviewId, '1');
    localeReview = {
      id: approvedReview.id,
      version: Number(approvedReview.version),
    };
  }, 300_000);

  it('holds an approved review of a locale variant whose frozen manifest names the source revision and its hash', () => {
    expect(reviewState(localeReview.id)).toBe(
      `approved/-/${localeReview.version}`,
    );
    expect(
      psql(`select (dependency_manifest->'localeSources'->0->>'revisionId') || '|'
              || (dependency_manifest->'localeSources'->0->>'locale') || '|'
              || ((dependency_manifest->'localeSources'->0->>'hash') = (
                   select payload_hash from platform_private.cms_entry_revisions
                    where id = '${sourceRevisionId}'))::text
          from platform_private.cms_editorial_reviews where id = '${localeReview.id}'`),
    ).toBe(`${sourceRevisionId}|en-US|true`);
    expect(
      psql(`select count(*) from platform_private.cms_editorial_review_dependencies
        where review_id = '${localeReview.id}' and kind = 'locale_source'
          and ref_id = '${sourceRevisionId}'`),
    ).toBe('1');
  });

  it('commits the stale marking and cms.localization.changed.v1 when the source changes, and leaves the review live until the recheck runs', () => {
    psql(editedSourceFixture(sourceRevisionId, randomUUID()));
    expect(
      psql(`select count(*) from platform_private.cms_locale_variants
        where revision_id = '${variantRevisionId}' and state = 'stale'
          and source_revision_id = '${sourceRevisionId}'`),
    ).toBe('1');
    [localizationEventId = '', localizationCorrelationId = ''] = psql(
      `select id::text || '|' || correlation_id::text from platform_private.outbox_events
        where event_type = 'cms.localization.changed.v1'
          and payload->>'revisionId' = '${variantRevisionId}'`,
    ).split('|');
    expect(localizationEventId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(reviewState(localeReview.id)).toBe(
      `approved/-/${localeReview.version}`,
    );
  });

  it('relays the committed event as an identifier-only envelope of the composition producer', async () => {
    localizationEnvelope = await relay(localizationEventId);
    expect(
      ReviewRecheckSourceEnvelopeSchema.parse(localizationEnvelope),
    ).toMatchObject({
      eventId: localizationEventId,
      eventType: 'cms.localization.changed.v1',
      schemaVersion: 1,
      producer: 'cms.composition',
      aggregateType: 'cms_content_entry',
      aggregateId: entryId,
      correlationId: localizationCorrelationId,
    });
    expect(Object.keys(localizationEnvelope)).not.toContain('payload');
  }, 300_000);

  it('consumes the envelope: resolves the SOURCE revision the review froze, not the variant revision, and enqueues the job', async () => {
    const sent = queued.length;
    const message = await deliver(localizationEnvelope);
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(exchangesOf(RESOLVE_RPC, localizationEventId)).toEqual([
      {
        rpc: RESOLVE_RPC,
        request: { p_event_id: localizationEventId },
        response: {
          found: true,
          kind: 'locale_source',
          refId: sourceRevisionId,
        },
        status: 200,
      },
    ]);
    [localizationJob] = queued
      .slice(sent)
      .filter(
        (body) =>
          (body as { jobType?: string }).jobType ===
          'cms.review.dependency_recheck',
      );
    expect(ReviewDependencyRecheckMessageSchema.parse(localizationJob)).toEqual(
      {
        jobType: 'cms.review.dependency_recheck',
        schemaVersion: 1,
        payload: {
          eventId: localizationEventId,
          kind: 'locale_source',
          refId: sourceRevisionId,
        },
        cursor: null,
        correlationId: localizationCorrelationId,
      },
    );
  });

  it('runs the job: the approved review whose source changed is invalidated dependency_changed', async () => {
    const job = await deliver(localizationJob);
    expect(job.ack).toHaveBeenCalledOnce();
    expect(job.retry).not.toHaveBeenCalled();
    expect(exchangesOf(RUN_RPC, localizationEventId)).toEqual([
      {
        rpc: RUN_RPC,
        request: {
          p_request: {
            eventId: localizationEventId,
            kind: 'locale_source',
            refId: sourceRevisionId,
            cursor: null,
          },
        },
        response: { examined: 1, invalidated: 1, nextCursor: null },
        status: 200,
      },
    ]);
    expect(reviewState(localeReview.id)).toBe(
      `invalidated/dependency_changed/${localeReview.version + 1}`,
    );
    expect(reviewEvents(localeReview.id, localizationCorrelationId)).toBe(1);
    expect(
      psql(`select count(*) from audit_private.audit_events
        where action = 'cms.entry.review.invalidate' and target_id = '${localeReview.id}'
          and correlation_id = '${localizationCorrelationId}'`),
    ).toBe('1');
  });

  it('is idempotent under redelivery: the same job finds no live review', async () => {
    const stateBefore = reviewState(localeReview.id);
    const eventsBefore = reviewEvents(localeReview.id);
    const job = await deliver(localizationJob, 2);
    expect(job.ack).toHaveBeenCalledOnce();
    expect(exchangesOf(RUN_RPC, localizationEventId).at(-1)?.response).toEqual({
      examined: 0,
      invalidated: 0,
      nextCursor: null,
    });
    expect(reviewState(localeReview.id)).toBe(stateBefore);
    expect(reviewEvents(localeReview.id)).toBe(eventsBefore);
    expect(reviewEvents(localeReview.id, localizationCorrelationId)).toBe(1);
  });
});

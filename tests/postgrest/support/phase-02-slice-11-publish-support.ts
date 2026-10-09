import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import {
  PreflightEvidenceSchema,
  PublicationResourceSchema,
} from '@wejammin/contracts';

import {
  EFFECT_TABLES,
  type EffectSnapshot,
  expectSafeEqual,
  expectStatus,
  snapshotDigest,
} from './phase-02-slice-11-assert';
import type { ReviewedDraft } from './phase-02-slice-11-flow';
import type { S11Response, S11Stack } from './phase-02-slice-11-stack';
import { psql } from './stack';

export const publicationBody = (
  draft: ReviewedDraft,
  over: Readonly<Record<string, unknown>> = {},
) => ({
  entryId: draft.entryId,
  revisionId: draft.revisionId,
  frozenHash: draft.frozenHash,
  expectedVersionSet: draft.versionSet,
  audience: 'public',
  expectedVersion: draft.reviewVersion,
  ...over,
});

export const sendPublication = (
  stack: S11Stack,
  draft: ReviewedDraft,
  options: {
    body?: Readonly<Record<string, unknown>>;
    ifMatch?: string;
    key?: string;
    requestId?: string;
  } = {},
) =>
  stack.post('/api/v1/cms/publications', {
    body: publicationBody(draft, options.body),
    ifMatch: options.ifMatch ?? draft.reviewVersion,
    ...(options.key === undefined ? {} : { idempotencyKey: options.key }),
    ...(options.requestId === undefined
      ? {}
      : {
          headers: { 'x-request-id': options.requestId },
        }),
  });

/** Safe parsing: never let Zod echo a candidate body into failure diagnostics. */
export const parsePublication = (response: S11Response) => {
  expectStatus(response, 202);
  const parsed = PublicationResourceSchema.safeParse(response.body);
  if (!parsed.success) throw new Error('invalid strict publication resource');
  return parsed.data;
};

/** Independent RFC 8785 serialization of the JSON-only publication hash input. */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('publication hash input is not finite JSON');
};

export const canonicalHash = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');

/**
 * Exact append delta over all fourteen full-row groups. Excluding only the
 * expected new rows from the hash must restore the entire baseline hash, while
 * the unfiltered counts must advance by exactly the specified amounts. Thus an
 * unrelated insert, deleted row or same-count mutation cannot hide in a changed
 * group. Predicates are test-owned SQL, never caller-controlled text.
 */
export const expectOnlyAppends = (
  before: EffectSnapshot,
  additions: Readonly<
    Record<string, Readonly<{ predicate: string; count: number }>>
  >,
): void => {
  const projected = snapshotDigest(
    Object.fromEntries(
      Object.entries(additions).map(([table, addition]) => [
        table,
        `case when ${addition.predicate} then null else pg_catalog.to_jsonb(t)::text end`,
      ]),
    ),
  );
  expect(Object.keys(before).sort()).toEqual([...EFFECT_TABLES].sort());
  for (const table of EFFECT_TABLES) {
    const [count, hash] = (before[table] ?? '').split(':');
    expectSafeEqual(
      projected[table],
      `${Number(count) + (additions[table]?.count ?? 0)}:${hash}`,
      `exact append delta for ${table}`,
    );
  }
};

export const expectPublicationAppend = (
  before: EffectSnapshot,
  publication: ReturnType<typeof parsePublication>,
  requestId: string,
  evidenceInput: unknown,
): void => {
  const rowId = publication.publicationVersionId;
  const parsed = PreflightEvidenceSchema.safeParse(evidenceInput);
  if (!parsed.success)
    throw new Error('publication has no strict command evidence');
  const evidence = parsed.data;
  expectOnlyAppends(before, {
    'platform_private.cms_publication_versions': {
      predicate: `t.id = '${rowId}'`,
      count: 1,
    },
    'platform_private.idempotency_records': {
      predicate: `t.operation = 'CMS-03B-09' and t.response_ref->>'resourceRef' = '${rowId}'`,
      count: 1,
    },
    'platform_private.outbox_events': {
      predicate: `t.event_type = 'cms.publication.changed.v1' and t.payload->>'publicationVersionId' = '${rowId}' and t.correlation_id = '${requestId}'`,
      count: 1,
    },
    'audit_private.audit_events': {
      predicate: `t.target_id = '${rowId}' and t.action = 'cms.publication.publish' and t.correlation_id = '${requestId}'`,
      count: 1,
    },
    'platform_private.cms_command_accessibility_evidence': {
      predicate: `t.subject_id = '${rowId}' and t.operation_id = 'CMS-03B-09' and t.correlation_id = '${requestId}'`,
      count: 1,
    },
  });
  const validEffects = psql(`select
    exists (select 1 from platform_private.idempotency_records r
      where r.operation = 'CMS-03B-09' and r.state = 'completed'
        and r.response_ref->>'resourceRef' = '${rowId}'
        and r.response_ref->'safeHeaders'->'response'->>'publicationHash' = '${publication.publicationHash}')
    and exists (select 1 from platform_private.outbox_events e
      where e.event_type = 'cms.publication.changed.v1'
        and e.aggregate_id = '${publication.id}'
        and e.aggregate_version = ${publication.version}
        and e.payload = jsonb_build_object('entryId', '${publication.entryId}',
          'publicationVersionId', '${rowId}')
        and e.correlation_id = '${requestId}')
    and exists (select 1 from platform_private.cms_command_accessibility_evidence a
      join platform_private.outbox_events e on e.id = a.event_id
      where a.subject_id = '${rowId}' and a.revision_id = '${publication.revisionId}'
        and a.operation_id = 'CMS-03B-09' and a.state = 'recorded' and a.version = 1
        and a.checker_key = 'cms.a11y.structural' and a.checker_version = ${evidence.providerVersion}
        and a.outcome = 'healthy' and a.blocking_count = 0
        and a.input_hash = '${evidence.inputHash}' and a.created_at = a.updated_at
        and a.correlation_id = '${requestId}'
        and e.payload->>'publicationVersionId' = '${rowId}')`);
  expect(
    validEffects === 't',
    'reservation and exactly targeted event bindings',
  ).toBe(true);
};

export const expectRpcIdentity = (
  stack: S11Stack,
  rpcName: string,
  requestId: string,
): void => {
  const rpc = stack.rpcs().find((item) => item.rpc === rpcName);
  expect(rpc !== undefined, 'expected command reached real PostgREST').toBe(
    true,
  );
  const context = rpc?.request.context as Record<string, unknown> | undefined;
  expectSafeEqual(context?.requestId, requestId, 'RPC request identity');
  expectSafeEqual(
    context?.correlationId,
    requestId,
    'RPC correlation identity',
  );
};

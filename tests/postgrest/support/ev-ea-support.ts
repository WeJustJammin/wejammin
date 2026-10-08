/**
 * Shared helpers of the lane-EA evidence suites (`phase-02-slice-10-ev-ea-*.apispec.ts`): the
 * request chain, fixtures and the assertions every CMS-03B-01..04 boundary test repeats. The
 * chain is `cms-editorial-stack.ts` (browser request -> first-party proxy -> production Worker ->
 * production RPC adapter -> Kong -> PostgREST -> newest SQL); nothing here fakes a response.
 */
import { createHmac, randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import { createCmsApp, draftTypeBody, ownerSession } from './cms-app';
import {
  type EditorialWorld,
  appendEntryBody,
  effectCounts,
} from './cms-editorial-world';
import type {
  EditorialSession,
  EditorialStack,
  StackResponse,
} from './cms-editorial-stack';
import { createAuthUser, createPerson, psql } from './stack';

/** One violation as the Worker publishes it: pointer, stable code, fixed safe message. */
export type Violation = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

export const SAFE_VIOLATION_MESSAGE = 'The value is invalid.';

export const violation = (path: string, code: string): Violation => ({
  path,
  code,
  message: SAFE_VIOLATION_MESSAGE,
});

export const violationsOf = (response: StackResponse): readonly Violation[] => {
  const details = response.body.details as
    { violations?: readonly Violation[] } | undefined;
  return details?.violations ?? [];
};

/**
 * Every durable effect a command can leave: the per-entry counts of `effectCounts` plus the
 * database-wide counts of entries, field values, relations, restore-chain manifests and
 * idempotency reservations, so a refused request that left a reservation, a value row or a
 * manifest behind is caught as well as one that appended a revision.
 */
export const snapshot = (
  entryId: string,
): ReturnType<typeof effectCounts> &
  Readonly<{
    allEntries: number;
    values: number;
    relations: number;
    manifests: number;
    reservations: number;
  }> => {
  const [allEntries, values, relations, manifests, reservations] = psql(`
    select (select count(*) from platform_private.cms_content_entries),
           (select count(*) from platform_private.cms_entry_field_values),
           (select count(*) from platform_private.cms_entry_relations),
           (select count(*) from platform_private.cms_restore_chain_manifests),
           (select count(*) from platform_private.idempotency_records)`)
    .split('|')
    .map(Number);
  return {
    ...effectCounts(entryId),
    allEntries: allEntries ?? 0,
    values: values ?? 0,
    relations: relations ?? 0,
    manifests: manifests ?? 0,
    reservations: reservations ?? 0,
  };
};

/**
 * The refusal contract of a rejected request: status, closed ApiError code, exactly the stated
 * violations, no committed-outcome marker and no durable effect on the entry.
 */
export const expectRefusal = (
  response: StackResponse,
  expected: Readonly<{
    status: number;
    code: string;
    violations?: readonly Violation[];
    details?: Readonly<Record<string, unknown>>;
  }>,
  entryId: string,
  before: ReturnType<typeof snapshot>,
): void => {
  expect(response.status, response.text).toBe(expected.status);
  expect(response.body.code, response.text).toBe(expected.code);
  if (expected.violations !== undefined)
    expect(violationsOf(response)).toEqual(expected.violations);
  if (expected.details !== undefined)
    expect(response.body.details).toMatchObject(expected.details);
  expect(response.headers.get('x-cms-editorial-outcome')).toBeNull();
  expect(snapshot(entryId)).toEqual(before);
};

/** A verified session of a person who is a confirmed member of the owner with no CMS grant. */
export const memberWithoutGrant = (world: EditorialWorld): EditorialSession => {
  const authUserId = createAuthUser(randomUUID());
  const personId = createPerson(authUserId);
  psql(`
    insert into identity_private.membership_tenure(
      id, organization_id, person_id, state, provenance, governance_mode,
      starts_on, accepted_at, actor_id, version)
    values (gen_random_uuid(), '${world.owner.organizationId}', '${personId}',
            'confirmed', 'invitation', 'ungoverned', current_date,
            clock_timestamp(), '${world.owner.personId}', 1)`);
  return {
    userId: authUserId,
    actingPartyId: world.owner.organizationId,
    // The Worker admits the route; whether this person may act is the database's call.
    capabilities: ['cms.author', 'cms.editor'],
    mfaFresh: false,
  };
};

/** A verified session of a person who is not a member of the owning organization at all. */
export const outsider = (world: EditorialWorld): EditorialSession => {
  const authUserId = createAuthUser(randomUUID());
  createPerson(authUserId);
  return {
    userId: authUserId,
    actingPartyId: world.owner.organizationId,
    capabilities: ['cms.author', 'cms.editor'],
    mfaFresh: false,
  };
};

/** Runs SQL under the transaction-local CMS RPC flag every fixture write needs. */
export const withCmsRpc = (sql: string): string =>
  psql(`begin; select set_config('app.cms_rpc', 'true', true); ${sql} commit;`);

export const setEntryLifecycle = (entryId: string, lifecycle: string): void => {
  withCmsRpc(
    `update platform_private.cms_content_entries set lifecycle = '${lifecycle}' where id = '${entryId}';`,
  );
};

/** The entry version a read reports through the draft detail ETag. */
export const currentEntryVersion = (entryId: string): string =>
  psql(
    `select version from platform_private.cms_content_entries where id = '${entryId}'`,
  );

export type RichWorld = Readonly<{
  contentTypeVersionId: string;
  titleFieldId: string;
  bodyFieldId: string;
}>;

/**
 * A second active content type with a `title` short_text and a `body` rich_text field bound to
 * the protected `rich_text.v1` validator pair, created through the production registry app and
 * activated with the real workflow-policy member exactly as `prepareEditorialWorld` does.
 */
export const prepareRichTextType = async (
  world: EditorialWorld,
): Promise<RichWorld> => {
  const registry = createCmsApp(
    ownerSession(world.owner.authUserId, world.owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const base = draftTypeBody(
    `s10rich_${randomUUID().slice(0, 8).replaceAll('-', '')}`,
  );
  const bodyFieldId = randomUUID();
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...base,
      fields: [
        ...(base.fields as readonly unknown[]),
        {
          stableFieldId: bodyFieldId,
          key: 'body',
          kind: 'rich_text',
          constraints: {},
          required: false,
          validatorKey: 'rich_text.v1',
          validatorVersion: '1',
          defaultMode: 'none',
          localizationMode: 'none',
          editorConfig: { label: 'Body', order: 1 },
          lifecycle: 'active',
        },
      ],
    },
  });
  expect(created.status).toBe(201);
  const typeId = String(created.body.contentTypeId);
  const versionId = String(created.body.id);
  withCmsRpc(`
    update platform_private.cms_content_type_versions version_row
       set state = 'active',
           version = version_row.version + 1,
           activation_workflow_policy_key = member.m->>'key',
           activation_workflow_policy_version = (member.m->>'version')::bigint,
           activation_workflow_policy_hash = member.m->>'policyHash',
           activation_required_decision_count = (member.m->>'requiredDecisionCount')::integer,
           activation_required_capabilities = member.m->'requiredCapabilities',
           activation_approval_evidence_hash = repeat('b', 64),
           updated_at = clock_timestamp()
      from (select platform_private.cms_workflow_policy_member('editorial', 1) as m) member
     where version_row.id = '${versionId}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${typeId}';`);
  const titleFieldId = psql(`
    select stable_field_id from platform_private.cms_field_definition_versions
     where content_type_version_id = '${versionId}' and field_key = 'title'`);
  return { contentTypeVersionId: versionId, titleFieldId, bodyFieldId };
};

/** The smallest canonical `rich_text.v1` document: one paragraph with one unmarked span. */
export const canonicalRichText = (text: string): Record<string, unknown> => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [{ text, marks: [] }] }],
});

/**
 * Records the single open conflict of `entry`: a same-field save from the stale base revision 1
 * while the draft has moved on, then reads the conflict id the draft detail names.
 */
export const openConflictOn = async (
  stack: EditorialStack,
  world: EditorialWorld,
  entry: string,
  expectedVersion: string,
  title: string,
): Promise<string> => {
  const clash = await stack.append(
    entry,
    appendEntryBody(world, entry, title, '1', expectedVersion),
    { ifMatch: expectedVersion },
  );
  expect(clash.status, clash.text).toBe(409);
  const draft = await stack.draftDetail(entry);
  expect(draft.status, draft.text).toBe(200);
  return (draft.body.openConflict as { conflictId: string }).conflictId;
};

/** RFC 8785 canonical JSON for the flat string-member envelopes the signed cursors carry. */
const jcs = (value: Readonly<Record<string, unknown>>): string =>
  `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`)
    .join(',')}}`;

/** The test signing key `prepareGateWorld` stores in the Vault (`repeat('a1', 32)` as hex). */
const CURSOR_KEY = Buffer.from('a1'.repeat(32), 'hex');

/** A decoded signed history cursor envelope (`expiresAt`, `keyId`, `lastRevisionId`, ...). */
export const decodeCursor = (cursor: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as Record<
    string,
    unknown
  >;

/** URL-encoded base64 of an envelope, signed for the CMS-03B-03 domain unless `sign` is false. */
export const encodeCursor = (
  envelope: Readonly<Record<string, unknown>>,
  options: Readonly<{ sign?: boolean }> = {},
): string => {
  const { keyId, signature, ...payload } = envelope as Record<
    string,
    unknown
  > & {
    keyId: string;
    signature: string;
  };
  const full =
    options.sign === false
      ? envelope
      : {
          ...payload,
          keyId,
          signature: createHmac('sha256', CURSOR_KEY)
            .update(`cms-03b-03:v1:${keyId}:${jcs(payload)}`)
            .digest('hex'),
        };
  void signature;
  return encodeURIComponent(
    Buffer.from(
      options.sign === false ? JSON.stringify(full) : jcs(full),
    ).toString('base64'),
  );
};

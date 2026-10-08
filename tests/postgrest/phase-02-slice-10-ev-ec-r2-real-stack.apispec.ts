/**
 * Slice 10 evidence lane EC, remediation R2, real stack (proxy -> production Worker -> production
 * RPC adapter -> Kong -> PostgREST -> newest SQL), one isolated owner and one ACTIVE type with a
 * DEC-133 object field. Two questions:
 *
 *   - AC-080: does RESTORE apply the same object structure and value semantics as the TypeScript
 *     validator? The SOURCE revision of a two-revision entry has its stored object value replaced
 *     with each value of one corpus (row triggers skipped, hashes kept consistent: no command can
 *     produce a stored value the validator refuses, so a corrupt source is the only way to feed
 *     restore the corpus). CMS-03B-04 restore of that revision answers 201 and carries the value
 *     into the new draft exactly when `isObjectValueForStructure` admits it, and otherwise answers
 *     a typed 4xx that changes nothing. The source is put back in a `finally`, so one corrupt
 *     committed revision never reaches a later suite (it would turn the owner's whole list read
 *     into INTERNAL_ERROR).
 *   - AC-105: does the create round trip PRESERVE SERVER AUTHORITY? A create that carries a
 *     caller-supplied authority member, or a projection member that is not the one the server
 *     served (artifact hash, workflow policy, activation evidence), is refused and changes nothing
 *     (a typed 4xx, or the retryable DEPENDENCY_UNAVAILABLE for evidence the server re-fetches),
 *     while the unmodified projection commits (the control).
 *
 * Commits fixtures under its own isolated owner: run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  ObjectStructureSchema,
  isObjectValueForStructure,
  type ObjectStructure,
} from '@wejammin/contracts';

import { createCmsApp, ownerSession } from './support/cms-app';
import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import {
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';
import {
  authorSession,
  prepareEditorialWorld,
  type EditorialWorld,
} from './support/cms-editorial-world';
import { psql } from './support/stack';

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

const STRUCTURE: ObjectStructure = ObjectStructureSchema.parse({
  properties: [
    {
      key: 'label',
      kind: 'scalar',
      required: true,
      constraints: { minLength: 1, maxLength: 20 },
    },
    {
      key: 'count',
      kind: 'scalar',
      required: false,
      constraints: { minimum: 0, maximum: 10 },
    },
    {
      key: 'tone',
      kind: 'enum',
      required: true,
      constraints: { enumValues: ['casual', 'formal'] },
    },
  ],
});

const SEED: Json = { label: 'Seed', tone: 'formal' };

const CORPUS: ReadonlyArray<readonly [string, Json]> = [
  ['the required properties only', { label: 'A', tone: 'casual' }],
  ['every property', { label: 'Launch', count: 3, tone: 'casual' }],
  ['a count at the maximum', { label: 'A', count: 10, tone: 'formal' }],
  ['an undeclared key', { label: 'A', tone: 'formal', extra: 1 }],
  ['a missing required key', { label: 'A' }],
  ['an enum outside the declared choices', { label: 'A', tone: 'loud' }],
  [
    'a nested value for a scalar property',
    { label: { deep: 1 }, tone: 'formal' },
  ],
  ['a JSON null for a scalar property', { label: null, tone: 'formal' }],
  [
    'a label over its maximum length',
    { label: 'x'.repeat(21), tone: 'formal' },
  ],
  ['a count above its maximum', { label: 'A', count: 11, tone: 'formal' }],
  ['an array instead of an object', [1, 2]],
];

let world: EditorialWorld;
let stack: EditorialStack;
let projection: Record<string, unknown> = {};
let versionId = '';
let titleField = '';
let metaField = '';

const durable = (): string =>
  psql(`
    select (select count(*) from audit_private.audit_events),
           (select count(*) from platform_private.outbox_events),
           (select count(*) from platform_private.cms_content_entries),
           (select count(*) from platform_private.cms_entry_revisions),
           (select count(*) from platform_private.cms_entry_field_values),
           (select count(*) from platform_private.idempotency_records)`);

const activate = (type: string, version: string): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
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
     where version_row.id = '${version}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${type}';
    commit;`);
};

const fieldId = (key: string): string =>
  psql(`select stable_field_id from platform_private.cms_field_definition_versions
         where content_type_version_id = '${versionId}' and field_key = '${key}'`);

const createBody = (values: Record<string, Json>) => ({
  contentTypeId: projection.contentTypeId,
  contentTypeVersionId: projection.contentTypeVersionId,
  locale: 'en-US',
  changedPaths: Object.keys(values).map((id) => `/fields/${id}`),
  values,
  schemaArtifact: projection.schemaArtifact,
  validatorRefs: projection.validatorRefs,
  workflowPolicy: projection.workflowPolicy,
  activationEvidence: projection.activationEvidence,
});

/** Replaces the stored object value of one revision, keeping the value and payload hashes consistent. */
const setStoredValue = (revisionId: string, value: Json): void => {
  const literal = `$ec$${JSON.stringify(value)}$ec$::jsonb`;
  psql(`
    begin;
    set local session_replication_role = replica;
    update platform_private.cms_entry_field_values
       set value = ${literal},
           value_hash = platform_private.cms_jcs_sha256(${literal})::char(64)
     where revision_id = '${revisionId}' and field_id = '${metaField}';
    update platform_private.cms_entry_revisions
       set payload_hash = platform_private.cms_jcs_sha256((
         select jsonb_object_agg(field_value.field_id::text, field_value.value)
           from platform_private.cms_entry_field_values field_value
          where field_value.revision_id = cms_entry_revisions.id))::char(64)
     where id = '${revisionId}';
    commit;`);
};

const waitForPostgrest = async (): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await stack.list('?limit=1');
    if (response.status !== 500 && response.status !== 503) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  await waitForPostgrest();
  const registry = createCmsApp(
    ownerSession(world.owner.authUserId, world.owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const field = (
    key: string,
    kind: string,
    extra: Record<string, unknown>,
    order: number,
  ) => ({
    stableFieldId: randomUUID(),
    key,
    kind,
    constraints: {},
    required: false,
    validatorKey: null,
    validatorVersion: null,
    defaultMode: 'none',
    localizationMode: 'none',
    editorConfig: { label: key, order },
    lifecycle: 'active',
    ...extra,
  });
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      typeKey: `ecr2_${randomUUID().slice(0, 8).replaceAll('-', '')}`,
      label: 'EC R2 restore parity',
      ownerCapability: 'cms.schema_designer',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      fallbackChains: {},
      workflowKey: 'editorial',
      workflowVersion: '1',
      defaultTemplateVersionId: null,
      fields: [
        field('title', 'short_text', { required: true }, 0),
        field(
          'meta',
          'object',
          { constraints: { objectStructure: STRUCTURE } },
          1,
        ),
      ],
      relations: [],
      templateBindings: [],
      capabilityBindings: [],
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  versionId = String(created.body.id);
  activate(String(created.body.contentTypeId), versionId);
  titleField = fieldId('title');
  metaField = fieldId('meta');
  const context = await stack.authoringContext(
    `?contentTypeVersionId=${versionId}`,
  );
  expect(context.status, context.text).toBe(200);
  projection = context.body.selectedType as Record<string, unknown>;
});

/** An entry of two revisions; returns the ids restore needs (revision 1 is the restore source). */
const seedEntry = async (): Promise<{
  entryId: string;
  sourceRevisionId: string;
  chainId: string;
}> => {
  const first = await stack.create(
    createBody({ [titleField]: 'Source', [metaField]: SEED }),
  );
  expect(first.status, first.text).toBe(201);
  const entryId = (first.body.entry as { id: string }).id;
  const sourceRevisionId = (first.body.revision as { id: string }).id;
  const second = await stack.append(
    entryId,
    {
      entryId,
      baseRevision: '1',
      changedPaths: [`/fields/${metaField}`],
      values: { [metaField]: { label: 'Second', tone: 'casual' } },
      locale: 'en-US',
      expectedVersion: '1',
    },
    { ifMatch: '1' },
  );
  expect(second.status, second.text).toBe(201);
  const history = await stack.history(
    entryId,
    `?compareRevisionId=${sourceRevisionId}`,
  );
  expect(history.status, history.text).toBe(200);
  const restore = (history.body.compare as { restore: Record<string, unknown> })
    .restore;
  expect(restore.availability).toBe('available');
  return {
    entryId,
    sourceRevisionId,
    chainId: String(restore.migrationChainId),
  };
};

const restoreOf = (seed: Awaited<ReturnType<typeof seedEntry>>) =>
  stack.restore(
    seed.entryId,
    seed.sourceRevisionId,
    {
      entryId: seed.entryId,
      revisionId: seed.sourceRevisionId,
      migrationChainId: seed.chainId,
      expectedVersion: '2',
    },
    { ifMatch: '2', idempotencyKey: `restore-${randomUUID()}` },
  );

describe('EC-080 restore applies the same object validator as TypeScript to the restored source value', () => {
  it.each(CORPUS)(
    'a restore of a source holding %s follows the TypeScript verdict',
    async (_name, value) => {
      const seed = await seedEntry();
      setStoredValue(seed.sourceRevisionId, value);
      const before = durable();
      let response: Awaited<ReturnType<typeof restoreOf>>;
      try {
        response = await restoreOf(seed);
      } finally {
        setStoredValue(seed.sourceRevisionId, SEED);
      }
      if (isObjectValueForStructure(STRUCTURE, value)) {
        expect(response.status, response.text).toBe(201);
        expect(response.body.state).toBe('draft');
        const draft = await stack.draftDetail(seed.entryId);
        expect(draft.status, draft.text).toBe(200);
        expect(JSON.stringify(draft.body.fields)).toContain(
          JSON.stringify((value as { label: string }).label),
        );
      } else {
        expect(response.status, response.text).toBeGreaterThanOrEqual(400);
        expect(response.status, response.text).toBeLessThan(500);
        expect(response.body.revisionNumber).toBeUndefined();
        expect(response.text).not.toContain('loud');
        expect(response.text).not.toContain('extra');
        expect(durable()).toBe(before);
      }
    },
  );
});

describe("EC-105 a create preserves server authority: the projection is the server's, never the caller's", () => {
  const tamperedMember = (
    member: string,
    change: (value: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    const body = createBody({ [titleField]: 'Authority', [metaField]: SEED });
    return {
      ...body,
      [member]: change(
        body[member as keyof typeof body] as Record<string, unknown>,
      ),
    };
  };

  it('the unmodified projection commits (control)', async () => {
    const response = await stack.create(
      createBody({ [titleField]: 'Authority control', [metaField]: SEED }),
    );
    expect(response.status, response.text).toBe(201);
  });

  it.each([
    ['createdBy', '10000000-0000-4000-8000-0000000000aa'],
    ['ownerId', '10000000-0000-4000-8000-0000000000aa'],
    ['actingPartyId', '20000000-0000-4000-8000-0000000000bb'],
    ['entryId', '30000000-0000-4000-8000-0000000000cc'],
    ['state', 'approved'],
  ])(
    'a caller-supplied %s member is refused and changes nothing',
    async (member, value) => {
      const before = durable();
      const response = await stack.create({
        ...createBody({ [titleField]: 'Authority', [metaField]: SEED }),
        [member]: value,
      });
      expect(response.status, response.text).toBeGreaterThanOrEqual(400);
      expect(response.status, response.text).toBeLessThan(500);
      expect(response.body.entry).toBeUndefined();
      expect(durable()).toBe(before);
    },
  );

  it.each([
    [
      'schemaArtifact',
      (v: Record<string, unknown>) => ({ ...v, artifactHash: 'f'.repeat(64) }),
    ],
    [
      'workflowPolicy',
      (v: Record<string, unknown>) => ({ ...v, policyHash: 'f'.repeat(64) }),
    ],
    [
      'activationEvidence',
      (v: Record<string, unknown>) => ({
        ...v,
        approvalEvidenceHash: 'f'.repeat(64),
      }),
    ],
  ])(
    'a %s that is not the one the server served is refused and changes nothing',
    async (member, change) => {
      const before = durable();
      const response = await stack.create(tamperedMember(member, change));
      expect(response.status, response.text).not.toBe(201);
      expect(response.body.entry).toBeUndefined();
      if (response.status >= 500) {
        // The server re-fetches the evidence it served: a mismatch is the retryable dependency
        // refusal (never an accepted create and never an unclassified failure).
        expect(response.status, response.text).toBe(503);
        expect(response.body.code).toBe('DEPENDENCY_UNAVAILABLE');
      } else {
        expect(response.status, response.text).toBeGreaterThanOrEqual(400);
      }
      expect(durable()).toBe(before);
    },
  );
});

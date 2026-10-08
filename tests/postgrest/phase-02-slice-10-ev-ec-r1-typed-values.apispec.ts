/**
 * Slice 10 evidence lane EC, remediation R1 (P2-S10-AC-073/078/080/081/083/084): an ACTIVE type
 * with a rich_text field and a DEC-133 object field is driven through the REAL chain (proxy ->
 * production Worker -> production RPC adapter -> Kong -> PostgREST -> newest SQL). The same
 * object and rich_text corpus is held to the TypeScript validators AND to every write path:
 *
 *   - CMS-03B-10 create, CMS-03B-01 append and CMS-03B-02 explicit resolution answer a typed 422
 *     `reasonCode` for exactly the values the TypeScript validator refuses, mutate nothing, and
 *     201 for exactly the values it admits;
 *   - the CMS-03B-11 draft read refuses (scrubbed 500, no value in the body) a STORED value the
 *     validator refuses and serves one it admits;
 *   - the CMS-03B-14 projection that feeds the editor carries the compiled object structure, and
 *     the browser descriptor built from it declares one property per `properties[]` entry.
 *
 * Commits fixtures (the owner and two active types): run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  AuthoringContextResourceSchema,
  ObjectStructureSchema,
  isObjectValueForStructure,
  isRichTextV1,
  type ObjectStructure,
} from '@wejammin/contracts';

import {
  describeCmsAuthoringFields,
  type CmsFieldDescriptor,
} from '../../apps/web/src/components/cms-editorial-fields/cms-field-descriptor';
import { validateCmsFieldValue } from '../../apps/web/src/components/cms-editorial-fields/cms-field-value';
import { CMS_EDITORIAL_REASON_COPY } from '../../apps/web/src/components/cms-editorial/cms-editorial-reason-copy';
import { protectedValidatorDescriptor } from '../../packages/contracts/src/content-schema-registry/protected-validators';
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
    {
      key: 'note',
      kind: 'rich_text',
      required: false,
      constraints: { maxLength: 200 },
    },
  ],
});

const richText = (text: string, extra: Record<string, Json> = {}): Json => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [{ text, marks: [], ...extra }] }],
});

const VALID_OBJECTS: ReadonlyArray<readonly [string, Json]> = [
  ['the required properties only', { label: 'A', tone: 'formal' }],
  [
    'every property',
    { label: 'Launch', count: 3, tone: 'casual', note: richText('Hello') },
  ],
  ['a count at the maximum', { label: 'A', count: 10, tone: 'formal' }],
];

const INVALID_OBJECTS: ReadonlyArray<readonly [string, Json]> = [
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
  [
    'a raw string for the rich_text property',
    { label: 'A', tone: 'formal', note: 'plain' },
  ],
  [
    'a non-canonical rich_text property',
    {
      label: 'A',
      tone: 'formal',
      note: {
        format: 'rich_text.v1',
        blocks: [
          {
            type: 'paragraph',
            spans: [
              { text: 'a', marks: [] },
              { text: 'b', marks: [] },
            ],
          },
        ],
      },
    },
  ],
  ['an array instead of an object', [1, 2]],
  ['a string instead of an object', 'meta'],
];

const BAD_RICH_TEXT: ReadonlyArray<readonly [string, Json]> = [
  ['a raw HTML string', '<script>alert(1)</script>'],
  [
    'a typed raw-HTML block',
    { format: 'rich_text.v1', blocks: [{ type: 'html', html: '<b>x</b>' }] },
  ],
  [
    'an inline embed span',
    {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            {
              text: 'x',
              marks: [],
              embed: { kind: 'image', src: 'https://example.com/a.png' },
            },
          ],
        },
      ],
    },
  ],
  [
    'an embed link kind',
    {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            {
              text: 'x',
              marks: [],
              link: { kind: 'embed', href: 'https://example.com' },
            },
          ],
        },
      ],
    },
  ],
  [
    'a javascript: link',
    richText('x', { link: { kind: 'https', href: 'javascript:alert(1)' } }),
  ],
  [
    'a data: link',
    richText('x', { link: { kind: 'https', href: 'data:text/html,<b>x</b>' } }),
  ],
  [
    'a protocol-relative internal route',
    richText('x', { link: { kind: 'internal', route: '//evil.example' } }),
  ],
  [
    'adjacent spans with equal marks',
    {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            { text: 'a', marks: [] },
            { text: 'b', marks: [] },
          ],
        },
      ],
    },
  ],
  ['an unknown mark', richText('x', { marks: ['underline'] })],
  [
    'heading level 1',
    {
      format: 'rich_text.v1',
      blocks: [
        { type: 'heading', level: 1, spans: [{ text: 'x', marks: [] }] },
      ],
    },
  ],
  [
    'an unknown top-level key',
    {
      format: 'rich_text.v1',
      blocks: [{ type: 'paragraph', spans: [] }],
      extra: 1,
    },
  ],
];

let world: EditorialWorld;
let stack: EditorialStack;
let projection: Record<string, unknown> = {};
let typeId = '';
let versionId = '';
let fieldIds: { title: string; body: string; meta: string } = {
  title: '',
  body: '',
  meta: '',
};
let entryId = '';
let entryVersion = '1';
let baseRevision = '1';

const durable = (): string =>
  psql(`
    select (select count(*) from audit_private.audit_events),
           (select count(*) from platform_private.outbox_events),
           (select count(*) from platform_private.cms_content_entries),
           (select count(*) from platform_private.cms_entry_revisions),
           (select count(*) from platform_private.cms_entry_field_values),
           (select count(*) from platform_private.cms_conflict_records),
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

const appendBody = (
  values: Record<string, Json>,
  base = baseRevision,
  version = entryVersion,
) => ({
  entryId,
  baseRevision: base,
  changedPaths: Object.keys(values).map((id) => `/fields/${id}`),
  values,
  locale: 'en-US',
  expectedVersion: version,
});

const reasonOf = (body: Record<string, unknown>): unknown =>
  (body.details as { reasonCode?: unknown } | undefined)?.reasonCode;

/**
 * Harness-only: right after `supabase db reset` PostgREST can still be reloading its schema cache
 * for the newest functions and answers a transient 500/503; wait (bounded) until the list read is
 * served so the first assertion measures the product, not the reload.
 */
const waitForPostgrest = async (stack: EditorialStack): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await stack.list('?limit=1');
    if (response.status !== 500 && response.status !== 503) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  await waitForPostgrest(stack);
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
      typeKey: `ecr1_${randomUUID().slice(0, 8).replaceAll('-', '')}`,
      label: 'EC R1 typed values',
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
        field('body', 'rich_text', {}, 1),
        field(
          'meta',
          'object',
          { constraints: { objectStructure: STRUCTURE } },
          2,
        ),
      ],
      relations: [],
      templateBindings: [],
      capabilityBindings: [],
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  typeId = String(created.body.contentTypeId);
  versionId = String(created.body.id);
  activate(typeId, versionId);
  fieldIds = {
    title: fieldId('title'),
    body: fieldId('body'),
    meta: fieldId('meta'),
  };
  const context = await stack.authoringContext(
    `?contentTypeVersionId=${versionId}`,
  );
  expect(context.status, context.text).toBe(200);
  projection = context.body.selectedType as Record<string, unknown>;
  const first = await stack.create(
    createBody({
      [fieldIds.title]: 'Seed',
      [fieldIds.meta]: { label: 'Seed', tone: 'formal' },
    }),
  );
  expect(first.status, first.text).toBe(201);
  entryId = (first.body.entry as { id: string }).id;
});

describe('EC-100/EC-102 an existing type that was never activated is neither offered nor distinguishable from an absent one', () => {
  it('lists only active compiled types and answers the same empty 404 for the draft type as for a random id', async () => {
    const registry = createCmsApp(
      ownerSession(world.owner.authUserId, world.owner.organizationId, [
        'cms.schema_designer',
      ]),
    );
    const draft = await registry.send('POST', '/api/v1/cms/content-types', {
      body: {
        typeKey: `ecr1draft_${randomUUID().slice(0, 8).replaceAll('-', '')}`,
        label: 'EC R1 never activated',
        ownerCapability: 'cms.schema_designer',
        sourceLocale: 'en-US',
        defaultLocale: 'en-US',
        supportedLocales: ['en-US'],
        fallbackChains: {},
        workflowKey: 'editorial',
        workflowVersion: '1',
        defaultTemplateVersionId: null,
        fields: [
          {
            stableFieldId: randomUUID(),
            key: 'title',
            kind: 'short_text',
            constraints: {},
            required: true,
            validatorKey: null,
            validatorVersion: null,
            defaultMode: 'none',
            localizationMode: 'none',
            editorConfig: { label: 'Title', order: 0 },
            lifecycle: 'active',
          },
        ],
        relations: [],
        templateBindings: [],
        capabilityBindings: [],
      },
    });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    const draftVersionId = String(draft.body.id);
    expect(
      psql(
        `select state from platform_private.cms_content_type_versions where id = '${draftVersionId}'`,
      ),
    ).toBe('draft');

    const list = await stack.authoringContext();
    expect(list.status, list.text).toBe(200);
    const offered = (
      list.body.creatableTypes as readonly { contentTypeVersionId: string }[]
    ).map((entry) => entry.contentTypeVersionId);
    expect(offered).toContain(versionId);
    expect(offered).toContain(world.contentTypeVersionId);
    expect(offered).not.toContain(draftVersionId);

    const absent = await stack.authoringContext(
      `?contentTypeVersionId=${randomUUID()}`,
    );
    const hidden = await stack.authoringContext(
      `?contentTypeVersionId=${draftVersionId}`,
    );
    expect(absent.status).toBe(404);
    expect(hidden.status).toBe(404);
    const strip = (body: Record<string, unknown>) => ({
      code: body.code,
      message: body.message,
      details: body.details,
    });
    expect(strip(hidden.body)).toEqual(strip(absent.body));
    expect(hidden.body.details).toEqual({});
    expect(hidden.text).not.toContain(draftVersionId);
  });
});

describe('EC-085 the compiled artifact of a type that uses rich_text freezes the TypeScript registry entry', () => {
  it('carries exactly the entry the TypeScript registry returns, inside the artifact hash that equals the definition hash', () => {
    const frozen = JSON.parse(
      psql(`select artifact.editor_manifest->'validators'
              from platform_private.cms_schema_artifacts artifact
              join platform_private.cms_content_type_versions version_row
                on version_row.schema_artifact_id = artifact.id
             where version_row.id = '${versionId}'`),
    ) as unknown;
    expect(frozen).toEqual([protectedValidatorDescriptor('rich_text.v1', 1)]);
    expect(
      psql(`select artifact.artifact_hash = version_row.definition_hash
              from platform_private.cms_schema_artifacts artifact
              join platform_private.cms_content_type_versions version_row
                on version_row.schema_artifact_id = artifact.id
             where version_row.id = '${versionId}'`),
    ).toBe('t');
  });
});

describe('EC-081 the projection that feeds the object editor carries the compiled structure', () => {
  it('serves the DEC-133 structure in the CMS-03B-14 field and the browser descriptor declares one property per entry', async () => {
    const response = await stack.authoringContext(
      `?contentTypeVersionId=${versionId}`,
    );
    expect(response.status, response.text).toBe(200);
    const resource = AuthoringContextResourceSchema.parse(response.body);
    const meta = resource.fields.find(
      (entry) => entry.stableFieldId === fieldIds.meta,
    );
    expect(meta?.kind).toBe('object');
    const served = ObjectStructureSchema.parse(
      (meta?.constraints as { objectStructure?: unknown }).objectStructure,
    );
    expect(served).toEqual(STRUCTURE);
    const descriptor = describeCmsAuthoringFields(resource.fields).find(
      (entry: CmsFieldDescriptor) => entry.fieldId === fieldIds.meta,
    );
    expect(descriptor?.kind).toBe('object');
    const properties = (
      descriptor as {
        properties?: readonly {
          key: string;
          kind: string;
          required: boolean;
        }[];
      }
    ).properties;
    expect(
      properties?.map((property) => [
        property.key,
        property.kind,
        property.required,
      ]),
    ).toEqual(
      STRUCTURE.properties.map((property) => [
        property.key,
        property.kind,
        property.required,
      ]),
    );
  });
});

describe('EC-078/EC-080 object values: TypeScript verdict equals the typed 422 of every write path', () => {
  it.each(VALID_OBJECTS)(
    'TypeScript admits %s and create, append and resolve accept it',
    async (_name, value) => {
      expect(isObjectValueForStructure(STRUCTURE, value)).toBe(true);
      const created = await stack.create(
        createBody({ [fieldIds.title]: 'Valid', [fieldIds.meta]: value }),
      );
      expect(created.status, created.text).toBe(201);
      const appended = await stack.append(
        entryId,
        appendBody({ [fieldIds.meta]: value }),
        { ifMatch: entryVersion },
      );
      expect(appended.status, appended.text).toBe(201);
      entryVersion = String(appended.body.entryVersion);
      baseRevision = String(appended.body.revisionNumber);
    },
  );

  it.each(INVALID_OBJECTS)(
    'TypeScript refuses %s and create and append answer a typed 422 that changes nothing',
    async (_name, value) => {
      expect(isObjectValueForStructure(STRUCTURE, value)).toBe(false);
      const before = durable();
      const created = await stack.create(
        createBody({ [fieldIds.title]: 'Invalid', [fieldIds.meta]: value }),
      );
      expect(created.status, created.text).toBe(422);
      expect(created.body.code).toBe('VALIDATION_FAILED');
      expect(reasonOf(created.body)).toBe('object_property_invalid');
      expect(created.headers.get('x-cms-editorial-outcome')).toBeNull();
      const appended = await stack.append(
        entryId,
        appendBody({ [fieldIds.meta]: value }),
        { ifMatch: entryVersion },
      );
      expect(appended.status, appended.text).toBe(422);
      expect(reasonOf(appended.body)).toBe('object_property_invalid');
      expect(durable()).toBe(before);
    },
  );

  it('explicit conflict resolution refuses an invalid object choice with the same typed 422 and leaves the conflict open, then accepts a valid one', async () => {
    const seeded = await stack.create(
      createBody({
        [fieldIds.title]: 'Resolve',
        [fieldIds.meta]: { label: 'One', tone: 'formal' },
      }),
    );
    const id = (seeded.body.entry as { id: string }).id;
    const second = await stack.append(
      id,
      {
        ...appendBody(
          { [fieldIds.meta]: { label: 'Two', tone: 'formal' } },
          '1',
          '1',
        ),
        entryId: id,
      },
      { ifMatch: '1' },
    );
    expect(second.status, second.text).toBe(201);
    const stale = await stack.append(
      id,
      {
        ...appendBody(
          { [fieldIds.meta]: { label: 'Three', tone: 'casual' } },
          '1',
          '2',
        ),
        entryId: id,
      },
      { ifMatch: '2' },
    );
    expect(stale.status, stale.text).toBe(409);
    const draft = await stack.draftDetail(id);
    const conflictId = (draft.body.openConflict as { conflictId: string })
      .conflictId;
    const resolve = (value: Json, key: string) =>
      stack.resolve(
        id,
        conflictId,
        {
          entryId: id,
          conflictId,
          baseRevision: '1',
          choices: [
            { path: `/fields/${fieldIds.meta}`, choice: 'explicit', value },
          ],
          expectedVersion: '2',
        },
        { ifMatch: '2', idempotencyKey: key },
      );
    const before = durable();
    const refused = await resolve(
      { label: 'A', tone: 'formal', extra: 1 },
      `resolve-bad-${randomUUID()}`,
    );
    expect(refused.status, refused.text).toBe(422);
    expect(reasonOf(refused.body)).toBe('object_property_invalid');
    expect(durable()).toBe(before);
    expect((await stack.conflictDetail(id, conflictId)).status).toBe(200);
    const accepted = await resolve(
      { label: 'Merged', tone: 'formal' },
      `resolve-ok-${randomUUID()}`,
    );
    expect(accepted.status, accepted.text).toBe(201);
  });
});

describe('EC-078/EC-080 the draft read applies the same object validator to a stored value', () => {
  const tamper = (id: string, value: Json): void => {
    psql(`
      begin;
      set local session_replication_role = replica;
      update platform_private.cms_entry_field_values
         set value = $ec$${JSON.stringify(value)}$ec$::jsonb,
             value_hash = platform_private.cms_jcs_sha256($ec$${JSON.stringify(value)}$ec$::jsonb)::char(64)
       where revision_id = (select current_draft_revision_id from platform_private.cms_content_entries where id = '${id}')
         and field_id = '${fieldIds.meta}';
      update platform_private.cms_entry_revisions
         set payload_hash = platform_private.cms_jcs_sha256((
           select jsonb_object_agg(field_value.field_id::text, field_value.value)
             from platform_private.cms_entry_field_values field_value
            where field_value.revision_id = cms_entry_revisions.id))::char(64)
       where id = (select current_draft_revision_id from platform_private.cms_content_entries where id = '${id}');
      commit;`);
  };

  it.each([...VALID_OBJECTS.slice(0, 2), ...INVALID_OBJECTS.slice(0, 5)])(
    'a stored %s is served exactly when the TypeScript validator admits it',
    async (_name, value) => {
      const created = await stack.create(
        createBody({
          [fieldIds.title]: 'Stored',
          [fieldIds.meta]: { label: 'Seed', tone: 'formal' },
        }),
      );
      const id = (created.body.entry as { id: string }).id;
      tamper(id, value);
      // The list read verifies every revision it summarises, so one corrupt stored value would
      // make the owner's whole list answer 500 for every later suite: restore it in all cases.
      let read: Awaited<ReturnType<typeof stack.draftDetail>>;
      try {
        read = await stack.draftDetail(id);
      } finally {
        tamper(id, { label: 'Seed', tone: 'formal' });
      }
      if (isObjectValueForStructure(STRUCTURE, value)) {
        expect(read.status, read.text).toBe(200);
        expect(JSON.stringify(read.body.fields)).toContain('"label"');
      } else {
        expect(read.status, read.text).toBe(500);
        expect(read.body.code).toBe('INTERNAL_ERROR');
        expect(read.text).not.toContain('extra');
        expect(read.text).not.toContain('loud');
      }
    },
  );
});

describe('EC-073/EC-083/EC-084 rich_text values: TypeScript verdict equals the typed 422', () => {
  it.each(BAD_RICH_TEXT)(
    '%s is refused by TypeScript and by create with reasonCode rich_text_not_canonical, changing nothing',
    async (_name, value) => {
      expect(isRichTextV1(value)).toBe(false);
      const descriptor = describeCmsAuthoringFields(
        AuthoringContextResourceSchema.parse(
          (await stack.authoringContext(`?contentTypeVersionId=${versionId}`))
            .body,
        ).fields,
      ).find((entry) => entry.fieldId === fieldIds.body) as CmsFieldDescriptor;
      expect(
        validateCmsFieldValue(descriptor, value as never).map(
          (issue) => issue.code,
        ),
      ).toContain('rich_text_not_canonical');
      const before = durable();
      const created = await stack.create(
        createBody({ [fieldIds.title]: 'Rich', [fieldIds.body]: value }),
      );
      expect(created.status, created.text).toBe(422);
      expect(reasonOf(created.body)).toBe('rich_text_not_canonical');
      const appended = await stack.append(
        entryId,
        appendBody({ [fieldIds.body]: value }),
        {
          ifMatch: entryVersion,
        },
      );
      expect(appended.status, appended.text).toBe(422);
      expect(reasonOf(appended.body)).toBe('rich_text_not_canonical');
      expect(durable()).toBe(before);
    },
  );

  it('keeps the browser reason copy for the one token PostgreSQL emits, and admits a canonical document everywhere', async () => {
    expect(Object.keys(CMS_EDITORIAL_REASON_COPY)).toContain(
      'rich_text_not_canonical',
    );
    const value = richText('Canonical');
    expect(isRichTextV1(value)).toBe(true);
    const created = await stack.create(
      createBody({ [fieldIds.title]: 'Rich ok', [fieldIds.body]: value }),
    );
    expect(created.status, created.text).toBe(201);
  });
});

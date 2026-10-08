/**
 * Fixtures of the lane-EA typed-reason suite: an ACTIVE content type with one field of every kind
 * that has a typed 422 reason in BE03b "Value encodings by field kind" (`rich_text`, DEC-133
 * `object`, `taxonomy`, `media` and a DOMAIN-kind `relation`), and an entry created through the
 * real create command. Nothing here fakes a response: the type goes through the registry API and
 * the entry through the same proxy -> Worker -> RPC -> PostgREST chain the suite then attacks.
 */
import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import { createCmsApp, draftTypeBody, ownerSession } from './cms-app';
import type { EditorialWorld } from './cms-editorial-world';
import type { EditorialStack } from './cms-editorial-stack';
import { psql } from './stack';
import { canonicalRichText, withCmsRpc } from './ev-ea-support';

export type TypedFieldKey =
  'title' | 'body' | 'meta' | 'tags' | 'hero' | 'people';

export type TypedWorld = Readonly<{
  contentTypeVersionId: string;
  fields: Readonly<Record<TypedFieldKey, string>>;
}>;

const OBJECT_STRUCTURE = {
  properties: [
    { key: 'label', kind: 'scalar', required: true, constraints: {} },
  ],
};

const field = (
  key: string,
  kind: string,
  order: number,
  extra: Readonly<Record<string, unknown>> = {},
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

/** Creates and activates the typed-value type through the registry API and the terminal state. */
export const prepareTypedValueType = async (
  world: EditorialWorld,
): Promise<TypedWorld> => {
  const registry = createCmsApp(
    ownerSession(world.owner.authUserId, world.owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const people = field('people', 'relation', 5);
  const base = draftTypeBody(
    `s10typed_${randomUUID().slice(0, 8).replaceAll('-', '')}`,
  );
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...base,
      fields: [
        ...(base.fields as readonly unknown[]),
        field('body', 'rich_text', 1, {
          validatorKey: 'rich_text.v1',
          validatorVersion: '1',
        }),
        field('meta', 'object', 2, {
          constraints: { objectStructure: OBJECT_STRUCTURE },
        }),
        field('tags', 'taxonomy', 3),
        field('hero', 'media', 4),
        people,
      ],
      relations: [
        {
          fieldId: people.stableFieldId,
          targetKind: 'domain',
          targetType: 'person',
          projectionKey: 'public.summary',
          cardinality: 'many',
          min: 0,
          max: 2,
          ordered: true,
          onUnavailable: 'omit',
        },
      ],
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
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
  const id = (key: string): string =>
    psql(`
      select stable_field_id from platform_private.cms_field_definition_versions
       where content_type_version_id = '${versionId}' and field_key = '${key}'`);
  return {
    contentTypeVersionId: versionId,
    fields: {
      title: id('title'),
      body: id('body'),
      meta: id('meta'),
      tags: id('tags'),
      hero: id('hero'),
      people: id('people'),
    },
  };
};

/** Creates an entry of the typed type with a canonical body and a structure-valid object. */
export const createTypedEntry = async (
  stack: EditorialStack,
  typed: TypedWorld,
): Promise<string> => {
  const context = await stack.authoringContext();
  const type = (
    context.body.creatableTypes as readonly Record<string, unknown>[]
  ).find(
    (candidate) =>
      candidate.contentTypeVersionId === typed.contentTypeVersionId,
  ) as Record<string, unknown>;
  const values = {
    [typed.fields.title]: 'Typed entry',
    [typed.fields.body]: canonicalRichText('First body'),
    [typed.fields.meta]: { label: 'First' },
  };
  const created = await stack.create({
    contentTypeId: type.contentTypeId,
    contentTypeVersionId: type.contentTypeVersionId,
    locale: 'en-US',
    changedPaths: Object.keys(values).map((id) => `/fields/${id}`),
    values,
    schemaArtifact: type.schemaArtifact,
    validatorRefs: type.validatorRefs,
    workflowPolicy: type.workflowPolicy,
    activationEvidence: type.activationEvidence,
  });
  expect(created.status, created.text).toBe(201);
  return (created.body.entry as { id: string }).id;
};

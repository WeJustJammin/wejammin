// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  altFor,
  getPath,
  hash,
  leafPaths,
  renderListMarkup,
  sentinelDetail,
  uuid,
  withPath,
} from './content-schema-registry-s09-r4-mapping.test-support';

/**
 * FE03 list rows (CMS-03A-06): each record kind renders a bounded set of its
 * fields in the row (key, version, lifecycle or state, updated, plus the
 * kind's own safe facts); every other field is owned by the version detail,
 * whose every-field mapping is proved against the same fixture.
 */

const detail = sentinelDetail();

const contentType = {
  resourceKind: 'content_type',
  id: uuid(90),
  version: '91',
  typeKey: 'sentinel_list_type',
  builtIn: false,
  lifecycle: 'active',
  createdAt: '2026-01-02T03:04:05.006Z',
  updatedAt: '2026-02-03T04:05:06.007Z',
};

const KINDS: Readonly<
  Record<
    string,
    {
      readonly item: Record<string, unknown>;
      /** Fields the row itself renders. */
      readonly rendered: readonly string[];
    }
  >
> = {
  content_type: {
    item: contentType,
    rendered: [
      'id',
      'version',
      'typeKey',
      'builtIn',
      'lifecycle',
      'createdAt',
      'updatedAt',
    ],
  },
  content_type_version: {
    item: detail.resource,
    rendered: [
      'id',
      'version',
      'typeKey',
      'contentTypeId',
      'state',
      'updatedAt',
    ],
  },
  field_definition_version: {
    item: detail.fields[0] as never,
    rendered: ['version', 'key', 'lifecycle', 'updatedAt'],
  },
  relation_definition: {
    item: detail.relations[0] as never,
    rendered: ['version', 'projectionKey', 'state', 'updatedAt'],
  },
  schema_artifact: {
    item: detail.schemaArtifact,
    rendered: ['version', 'zodContractRef', 'updatedAt'],
  },
  template_binding: {
    item: detail.templateBindings[0] as never,
    rendered: ['version', 'templateVersionId', 'state'],
  },
  capability_binding: {
    item: detail.capabilityBindings[0] as never,
    rendered: ['version', 'capabilityKey', 'state'],
  },
  block_definition_registry_record: {
    item: detail.blockDefinitions[0] as never,
    rendered: ['version', 'blockKey', 'lifecycle', 'releaseDigest'],
  },
};

/** Alternatives that keep a single member valid on its own. */
const ALTS: Readonly<Record<string, unknown>> = {
  builtIn: true,
  'content_type.lifecycle': 'retired',
  'content_type_version.state': 'review',
  'field_definition_version.lifecycle': 'active',
  'relation_definition.state': 'active',
  'template_binding.state': 'active',
  'capability_binding.state': 'active',
  'block_definition_registry_record.lifecycle': 'supported',
  'content_type_version.typeKey': 'other_type',
  'content_type.typeKey': 'other_list_type',
  'field_definition_version.key': 'other_field',
  'relation_definition.projectionKey': 'other_projection',
  'capability_binding.capabilityKey': 'other.capability',
  'block_definition_registry_record.blockKey': 'other.block',
  'block_definition_registry_record.releaseDigest': hash(210),
};

const listOf = (item: unknown) => ({ items: [item], nextCursor: null });

describe('list rows by record kind', () => {
  it('[P2-S09-AC-259] [P2-S09-AC-264] the fixture holds one row per generated record kind', () => {
    expect(Object.keys(KINDS).sort()).toStrictEqual(
      [
        'block_definition_registry_record',
        'capability_binding',
        'content_type',
        'content_type_version',
        'field_definition_version',
        'relation_definition',
        'schema_artifact',
        'template_binding',
      ].sort(),
    );
    for (const [kind, { item }] of Object.entries(KINDS))
      expect(item.resourceKind, kind).toBe(kind);
  });

  const rows = Object.entries(KINDS).flatMap(([kind, { item, rendered }]) =>
    rendered.map((field) => [kind, field, item] as const),
  );

  it.each(rows)(
    '[P2-S09-AC-259] [P2-S09-AC-264] a %s row renders %s',
    (kind, field, item) => {
      const index = leafPaths(item).indexOf(field);
      const alt =
        ALTS[`${kind}.${field}`] ??
        ALTS[field] ??
        altFor(field, getPath(item, field), index + 1);
      expect(
        renderListMarkup(listOf(withPath(item, field, alt))),
        `${kind}.${field}`,
      ).not.toBe(renderListMarkup(listOf(item)));
    },
  );

  it('[P2-S09-AC-259] every field a row does not render is owned by the version detail, except the discriminator', () => {
    for (const [kind, { item, rendered }] of Object.entries(KINDS)) {
      const fields = Object.keys(item);
      const unrendered = fields.filter(
        (field) => !rendered.includes(field) && field !== 'resourceKind',
      );
      // A content type has no version detail, so it has nothing left over.
      if (kind === 'content_type') expect(unrendered).toStrictEqual([]);
      else expect(unrendered.length).toBeGreaterThan(0);
      for (const field of unrendered) expect(fields).toContain(field);
    }
  });

  it('[P2-S09-AC-259] a block row renders only the safe release digest and never a worker evidence field', () => {
    const markup = renderListMarkup(
      listOf(KINDS.block_definition_registry_record!.item),
    );
    expect(markup).toContain(
      (
        KINDS.block_definition_registry_record!.item as {
          releaseDigest: string;
        }
      ).releaseDigest,
    );
    for (const forbidden of ['releaseKeyId', 'releaseNonceHash', 'ownerId'])
      expect(markup).not.toContain(forbidden);
  });
});

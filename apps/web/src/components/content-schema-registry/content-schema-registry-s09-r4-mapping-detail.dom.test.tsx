// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  BlockDefinitionRegistryRecordSchema,
  CapabilityBindingResourceSchema,
  ContentSchemaRegistryDetailSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  RelationDefinitionResourceSchema,
  SchemaArtifactResourceSchema,
  TemplateBindingResourceSchema,
  WorkflowPolicyEvidenceSchema,
} from '@wejammin/contracts';

import {
  altFor,
  getPath,
  leafPaths,
  mapsToMarkup,
  renderDetailMarkup,
  sentinelDetail,
  withPaths,
} from './content-schema-registry-s09-r4-mapping.test-support';

/**
 * FE03 "Response field ownership": every browser-visible field of the CMS-03A-07
 * detail (CMS-03A-04 evidence members and the OD-4 locale members included)
 * reaches the markup of the version detail. The fixture is parsed through the
 * generated strict contracts; for each field, a different contract-valid value
 * must change what the real component renders.
 */

const base = sentinelDetail();
const parse = (candidate: unknown) =>
  ContentSchemaRegistryDetailSchema.parse(candidate);

/** Fields that are deliberately not displayed, each with the reason. */
const NOT_DISPLAYED: Readonly<Record<string, string>> = {
  resourceKind: 'strict discriminator literal of the detail envelope',
  'resource.resourceKind': 'strict discriminator literal',
  'fields.0.resourceKind': 'strict discriminator literal',
  'relations.0.resourceKind': 'strict discriminator literal',
  'schemaArtifact.resourceKind': 'strict discriminator literal',
  'templateBindings.0.resourceKind': 'strict discriminator literal',
  'capabilityBindings.0.resourceKind': 'strict discriminator literal',
  'blockDefinitions.0.resourceKind': 'strict discriminator literal',
  'fields.0.contentTypeVersionId': 'parent link: shown inside its own version',
  'relations.0.contentTypeVersionId':
    'parent link: shown inside its own version',
  'schemaArtifact.contentTypeVersionId':
    'parent link: shown inside its own version',
  'templateBindings.0.contentTypeVersionId':
    'parent link: shown inside its own version',
  'capabilityBindings.0.contentTypeVersionId':
    'parent link: shown inside its own version',
};

/**
 * Locale members must stay a valid configuration, so each one changes together
 * with the members that keep the chain rules satisfied.
 */
const LOCALE_CHANGES: Readonly<Record<string, Record<string, unknown>>> = {
  'resource.sourceLocale': { 'resource.sourceLocale': 'fr-CA' },
  'resource.defaultLocale': {
    'resource.defaultLocale': 'fr-CA',
    'resource.fallbackChains': { 'en-US': ['fr-CA'] },
  },
  'resource.supportedLocales': {
    'resource.supportedLocales': ['en-US', 'fr-CA', 'de'],
    'resource.fallbackChains': { 'fr-CA': ['en-US'], de: ['en-US'] },
  },
  'resource.fallbackChains.fr-CA': {
    'resource.supportedLocales': ['en-US', 'fr', 'fr-CA'],
    'resource.fallbackChains': { fr: ['en-US'], 'fr-CA': ['fr', 'en-US'] },
  },
};

/** Members whose contract-valid alternative must move linked members too. */
const OTHER_CHANGES: Readonly<Record<string, Record<string, unknown>>> = {
  'resource.typeKey': { 'resource.typeKey': 'other_type' },
  'resource.capabilityBindingCount': { 'resource.capabilityBindingCount': 5 },
  'resource.activationEvidence.requiredDecisionCount': {
    'resource.activationEvidence.requiredDecisionCount': 3,
  },
  'resource.activationEvidence.requiredCapabilities': {
    'resource.activationEvidence.requiredCapabilities': [
      'cms.reviewer.security',
    ],
  },
  'fields.0.key': { 'fields.0.key': 'other_field' },
  'fields.0.validatorKey': {
    'fields.0.validatorKey': null,
    'fields.0.validatorVersion': null,
  },
  'fields.0.validatorVersion': { 'fields.0.validatorVersion': '27' },
  'relations.0.cardinality': {
    'relations.0.cardinality': 'one',
    'relations.0.min': 0,
    'relations.0.max': 1,
  },
  'relations.0.min': { 'relations.0.min': 1 },
  'templateBindings.0.position': { 'templateBindings.0.position': 4 },
};

/**
 * Members with one generated value cannot differ; each is asserted by name in
 * the rendered text instead.
 */
const SINGLE_VALUED: Readonly<Record<string, string>> = {
  'schemaArtifact.state': 'Artifact state</dt><dd>compiled',
};

/** `activationPreparation` members are mapped by the preparation test. */
const isPreparation = (path: string): boolean =>
  path.startsWith('activationPreparation');

const fixtureLeaves = leafPaths(base);
const displayed = fixtureLeaves.filter(
  (path) =>
    !(path in NOT_DISPLAYED) &&
    !(path in SINGLE_VALUED) &&
    !isPreparation(path),
);

describe('generated fixture covers every contract field', () => {
  const covers = (schema: z.ZodType, object: unknown, label: string): void => {
    const json = z.toJSONSchema(schema, {
      io: 'input',
      unrepresentable: 'any',
    }) as { properties?: Record<string, unknown> };
    expect(
      Object.keys(object as Record<string, unknown>).sort(),
      label,
    ).toStrictEqual(Object.keys(json.properties ?? {}).sort());
  };

  it('[P2-S09-AC-259] the detail fixture carries every key of every generated browser contract it maps', () => {
    covers(ContentSchemaRegistryDetailSchema, base, 'detail envelope');
    covers(ContentTypeVersionResourceSchema, base.resource, 'version');
    covers(
      WorkflowPolicyEvidenceSchema,
      base.resource.activationEvidence,
      'evidence',
    );
    covers(FieldDefinitionVersionResourceSchema, base.fields[0], 'field');
    covers(RelationDefinitionResourceSchema, base.relations[0], 'relation');
    covers(SchemaArtifactResourceSchema, base.schemaArtifact, 'artifact');
    covers(
      TemplateBindingResourceSchema,
      base.templateBindings[0],
      'template binding',
    );
    covers(
      CapabilityBindingResourceSchema,
      base.capabilityBindings[0],
      'capability binding',
    );
    covers(
      BlockDefinitionRegistryRecordSchema,
      base.blockDefinitions[0],
      'block record',
    );
  });

  it('[P2-S09-AC-259] a stale fixture fails at the contract: removing the OD-4 members is refused', () => {
    expect(
      ContentSchemaRegistryDetailSchema.safeParse(
        withPaths(base, { 'resource.supportedLocales': undefined }),
      ).success,
    ).toBe(false);
  });
});

describe('every browser-visible detail field is rendered by the version detail', () => {
  it.each(displayed)(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s changes the rendered detail',
    (path) => {
      const changes =
        LOCALE_CHANGES[path] ??
        OTHER_CHANGES[path] ??
        ({
          [path]: altFor(
            path,
            getPath(base, path),
            fixtureLeaves.indexOf(path),
          ),
        } as Record<string, unknown>);
      expect(
        renderDetailMarkup(base) !==
          renderDetailMarkup(parse(withPaths(base, changes))),
        path,
      ).toBe(true);
    },
  );

  it('[P2-S09-AC-259] single-valued enumerations are rendered by name', () => {
    const markup = renderDetailMarkup(base);
    for (const text of Object.values(SINGLE_VALUED))
      expect(markup).toContain(text);
  });

  it('[P2-S09-AC-264] shows the relation policy and field definition members as named values', () => {
    const markup = renderDetailMarkup(base);
    for (const text of [
      'Minimum related records</dt><dd>2',
      'Maximum related records</dt><dd>9',
      'Order preserved</dt><dd>Yes',
      'When target is unavailable</dt><dd>placeholder',
      'Target kind</dt><dd>domain',
      'Lifecycle</dt><dd>deprecated',
      'Default mode</dt><dd>literal',
      'Localization mode</dt><dd>localized',
    ])
      expect(markup).toContain(text);
  });

  it('[P2-S09-AC-259] the not-displayed set is exactly the discriminators and parent links, nothing else', () => {
    expect(Object.keys(NOT_DISPLAYED).sort()).toStrictEqual(
      fixtureLeaves.filter((path) => path in NOT_DISPLAYED).sort(),
    );
    for (const reason of Object.values(NOT_DISPLAYED))
      expect(reason).toMatch(/discriminator|parent link/u);
  });

  it('[P2-S09-AC-264] shows the OD-4 locale members as named values: languages, source, default, hash and the fallback order sentence', () => {
    const markup = renderDetailMarkup(base);
    expect(markup).toContain('en-US, fr-CA');
    expect(markup).toContain('Source language</dt><dd>en-US');
    expect(markup).toContain('Default language</dt><dd>en-US');
    expect(markup).toContain(base.resource.localeConfigHash);
    expect(markup).toContain('fr-CA: en-US');
  });

  it('[P2-S09-AC-259] a worker-only or owner field never reaches the detail markup', () => {
    const markup = renderDetailMarkup(base);
    for (const forbidden of [
      'ownerId',
      'owner_id',
      'releaseKeyId',
      'releaseRawBodyHash',
      'releaseSignatureHash',
      'releaseNonceHash',
      'releaseVerifiedAt',
      'propsSchemaSnapshot',
      'propsSnapshotAttestation',
    ])
      expect(markup).not.toContain(forbidden);
    // The unknown-key guard of the generated contract keeps them out of the parse.
    expect(
      ContentSchemaRegistryDetailSchema.safeParse(
        withPaths(base, { 'resource.ownerId': uuidLike }),
      ).success,
    ).toBe(false);
    expect(
      ContentSchemaRegistryDetailSchema.safeParse(
        withPaths(base, {
          'blockDefinitions.0.releaseNonceHash': 'a'.repeat(64),
        }),
      ).success,
    ).toBe(false);
  });
});

const uuidLike = '00000000-0000-7000-8000-000000000999';

describe('detail is unchanged by a field it does not map (control)', () => {
  it('[P2-S09-AC-259] re-rendering the identical fixture is stable, so a difference is caused by the changed field', () => {
    expect(renderDetailMarkup(base)).toBe(renderDetailMarkup(sentinelDetail()));
    expect(mapsToMarkup(base, 'resource.label', 'Sentinel Label')).toBe(false);
  });
});

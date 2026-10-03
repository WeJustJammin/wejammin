import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
} from '@wejammin/contracts';

import { detail as baseDetail } from './content-schema-registry-server-test-values';
import { emptyActivationPreparation } from './content-schema-registry-activation-preparation.test-support';
import {
  WorkbenchUnderTest,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * Generated-fixture support for the FE03 every-field mapping tests. A fixture
 * is parsed through the generated strict contract; a field is "mapped" when
 * changing only that field changes the markup the real component renders.
 */

export const uuid = (n: number): string =>
  `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
export const hash = (n: number): string =>
  n.toString(16).padStart(4, '0').repeat(16);
const instant = (n: number): string =>
  `2026-0${(n % 9) + 1}-1${n % 9}T0${n % 9}:1${n % 9}:2${n % 9}.00${n % 9}Z`;

type Json = Record<string, unknown>;

/** Deep-set `value` at a dotted/indexed path on a clone of `base`. */
export const withPath = <T,>(base: T, path: string, value: unknown): T => {
  const clone = structuredClone(base) as Json;
  const parts = path.split('.');
  let cursor: Json = clone;
  for (const part of parts.slice(0, -1))
    cursor = cursor[/^\d+$/u.test(part) ? Number(part) : part] as Json;
  cursor[parts.at(-1) as string] = value;
  return clone as T;
};

/**
 * Every leaf path of a fixture. Objects recurse, arrays of objects recurse by
 * index, and arrays of scalars are leaves.
 */
export const leafPaths = (value: unknown, prefix = ''): string[] => {
  const join = (key: string | number): string =>
    prefix === '' ? String(key) : `${prefix}.${key}`;
  if (Array.isArray(value))
    return value.length > 0 && typeof value[0] === 'object' && value[0] !== null
      ? value.flatMap((child, index) => leafPaths(child, join(index)))
      : [prefix];
  if (typeof value === 'object' && value !== null)
    return Object.entries(value as Json).flatMap(([key, child]) =>
      leafPaths(child, join(key)),
    );
  return [prefix];
};

export const getPath = (base: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (cursor, part) => (cursor as Json | unknown[])[part as never],
      base,
    );

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HASH64 = /^[0-9a-f]{64}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

/** Enumerations and nullable members whose different valid value is named here. */
export const ENUM_ALTS: Readonly<Record<string, unknown>> = {
  'resource.state': 'review',
  'resource.compatibility': 'breaking',
  'resource.activationEvidence.riskClass': 'ordinary',
  'resource.defaultTemplateVersionId': null,
  'resource.dryRunId': null,
  'resource.activationEvidence.requiredCapabilities': [],
  'fields.0.kind': 'long_text',
  'fields.0.defaultMode': 'none',
  'fields.0.localizationMode': 'none',
  'fields.0.lifecycle': 'active',
  'fields.0.validatorKey': null,
  'fields.0.validatorVersion': null,
  'fields.0.migrationPlanId': null,
  'relations.0.state': 'active',
  'relations.0.targetKind': 'content',
  'relations.0.cardinality': 'one',
  'relations.0.onUnavailable': 'omit',
  'schemaArtifact.state': 'failed',
  'templateBindings.0.state': 'active',
  'capabilityBindings.0.state': 'active',
  'blockDefinitions.0.lifecycle': 'supported',
};

/** A different, contract-shaped value for the leaf at `path`. */
export const altFor = (path: string, value: unknown, n: number): unknown => {
  if (path in ENUM_ALTS) return ENUM_ALTS[path];
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 100;
  if (typeof value !== 'string') throw new Error(`no alternative for ${path}`);
  if (UUID.test(value)) return uuid(800 + n);
  if (HASH64.test(value)) return hash(200 + (n % 50));
  if (INSTANT.test(value)) return '2025-01-01T00:00:00.000Z';
  if (/^\d+$/u.test(value)) return String(Number(value) + 900);
  return `${value}-alt`;
};

export const withPaths = <T,>(base: T, changes: Record<string, unknown>): T =>
  Object.entries(changes).reduce(
    (acc, [path, value]) => withPath(acc, path, value),
    base,
  );

export const sentinelDetail = () =>
  ContentSchemaRegistryDetailSchema.parse({
    resourceKind: 'content_type_version',
    resource: {
      ...baseDetail.resource,
      id: uuid(1),
      version: '41',
      contentHash: hash(2),
      createdAt: instant(3),
      updatedAt: instant(4),
      state: 'approved',
      contentTypeId: uuid(5),
      typeKey: 'sentinel_type',
      label: 'Sentinel Label',
      ownerCapability: 'cms.schema_registry.read',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'fr-CA'],
      fallbackChains: { 'fr-CA': ['en-US'] },
      localeConfigHash: hash(6),
      workflowKey: 'sentinel.workflow',
      workflowVersion: '73',
      defaultTemplateVersionId: uuid(7),
      schemaArtifactId: uuid(8),
      fieldCount: 17,
      relationCount: 23,
      capabilityBindingCount: 29,
      compatibility: 'additive',
      dryRunId: uuid(9),
      activationEvidence: {
        key: 'cms.sentinel.policy',
        version: '9',
        policyHash: hash(10),
        riskClass: 'protected',
        requiredDecisionCount: 2,
        requiredCapabilities: ['cms.reviewer.legal'],
        approvalEvidenceHash: hash(11),
      },
    },
    fields: [
      {
        resourceKind: 'field_definition_version',
        id: uuid(20),
        version: '21',
        contentHash: hash(22),
        createdAt: instant(23),
        updatedAt: instant(24),
        contentTypeVersionId: uuid(1),
        stableFieldId: uuid(25),
        key: 'sentinel_field',
        kind: 'short_text',
        required: true,
        validatorKey: 'sentinel.validator',
        validatorVersion: '26',
        defaultMode: 'literal',
        localizationMode: 'localized',
        lifecycle: 'deprecated',
        migrationPlanId: uuid(27),
      },
    ],
    relations: [
      {
        resourceKind: 'relation_definition',
        id: uuid(30),
        version: '31',
        contentHash: hash(32),
        createdAt: instant(33),
        updatedAt: instant(34),
        state: 'draft',
        contentTypeVersionId: uuid(1),
        fieldId: uuid(35),
        targetKind: 'domain',
        targetType: 'sentinel_target',
        projectionKey: 'sentinel_projection',
        cardinality: 'many',
        min: 2,
        max: 9,
        ordered: true,
        onUnavailable: 'placeholder',
      },
    ],
    schemaArtifact: {
      resourceKind: 'schema_artifact',
      id: uuid(8),
      version: '41',
      state: 'compiled',
      contentTypeVersionId: uuid(1),
      compilerVersion: 'compiler-sentinel',
      zodContractRef: 'cms/sentinel/v1',
      artifactHash: hash(42),
      createdAt: instant(43),
      updatedAt: instant(44),
      compiledAt: instant(45),
    },
    templateBindings: [
      {
        resourceKind: 'template_binding',
        id: uuid(50),
        contentTypeVersionId: uuid(1),
        templateVersionId: uuid(51),
        position: 3,
        version: '52',
        state: 'approved',
      },
    ],
    capabilityBindings: [
      {
        resourceKind: 'capability_binding',
        id: uuid(60),
        contentTypeVersionId: uuid(1),
        capabilityKey: 'sentinel.capability',
        capabilityVersion: '61',
        version: '62',
        state: 'approved',
      },
    ],
    blockDefinitions: [
      {
        resourceKind: 'block_definition_registry_record',
        id: uuid(70),
        version: '71',
        blockKey: 'sentinel.block',
        blockVersion: 72,
        propsSchemaRef: 'cms/sentinel-block',
        propsSchemaHash: hash(73),
        rendererRef: 'blocks/sentinel',
        releaseDigest: hash(74),
        lifecycle: 'deprecated',
      },
    ],
    activationPreparation: emptyActivationPreparation,
  });

export type SentinelDetail = ReturnType<typeof sentinelDetail>;

export const renderDetailMarkup = (detail: SentinelDetail): string =>
  renderToStaticMarkup(
    React.createElement(
      WorkbenchUnderTest,
      versionPageProps({ initialDetail: successDetail(detail) }),
    ),
  );

export const renderListMarkup = (list: unknown): string =>
  renderToStaticMarkup(
    React.createElement(
      WorkbenchUnderTest,
      versionPageProps({
        contentTypeId: null,
        versionId: null,
        initialDetail: null,
        initialList: {
          status: 'success',
          data: ContentSchemaRegistryListPageSchema.parse(list),
          version: '1',
          stale: false,
        } as never,
      }),
    ),
  );

/**
 * The paths a changed value reaches the markup through. A path is mapped when
 * `alt` (a different, contract-valid value) changes the rendered markup.
 */
export const mapsToMarkup = (
  base: SentinelDetail,
  path: string,
  alt: unknown,
  parse: (candidate: unknown) => SentinelDetail = (candidate) =>
    ContentSchemaRegistryDetailSchema.parse(candidate),
): boolean =>
  renderDetailMarkup(base) !==
  renderDetailMarkup(parse(withPath(base, path, alt)));

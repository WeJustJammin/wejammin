import { describe, expect, it } from 'vitest';

import {
  ApiErrorSchema,
  BlockRegistrationRequestSchema,
  CmsEd25519SignatureSchema,
  CmsStrongEtagSchema,
  ContentSchemaRegistryDetailParamsSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentTypeDraftRequestSchema,
  FieldConstraintsSchema,
  FieldDefinitionInputSchema,
  FieldSchemaChangeRequestSchema,
  PropsSchemaSnapshotSchema,
  RelationBindingRequestSchema,
  ReleaseEnvelopeHeadersSchema,
  SchemaActivationRequestSchema,
} from '@wejammin/contracts';
import {
  signature,
  uuid,
  validBlock,
  validDraft as sharedValidDraft,
  validField,
  validFieldChange,
  validRelation,
} from './phase-02-slice-09-adversarial-fixtures';

// BE03a OD-4 (2026-10-02) added the locale configuration to
// ContentTypeDraftRequest, ContentTypeVersionResource and SchemaActivationResource.
// The shared fixtures predate it, so this file supplies a valid configuration; the
// shared worker fixtures and the producers that must emit these members stay tracked
// by the reopened P2-S09-AC-264 (shared fixtures).
const validDraft = {
  ...sharedValidDraft,
  supportedLocales: ['en-US'],
  fallbackChains: {},
} as const;

describe('S09 adversarial contract boundaries', () => {
  it('[P2-S09-AC-216] bounds arrays, object keys, strings, signatures, and regex-shaped values', () => {
    const oneHundredTwentyEightFields = Array.from(
      { length: 128 },
      (_, index) => validField(index + 1),
    );
    const oneHundredTwentyNineFields = [
      ...oneHundredTwentyEightFields,
      validField(129),
    ];
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...validDraft,
        fields: oneHundredTwentyEightFields,
      }).success,
    ).toBe(true);
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...validDraft,
        fields: oneHundredTwentyNineFields,
      }).success,
    ).toBe(false);
    expect(
      ContentTypeDraftRequestSchema.safeParse({
        ...validDraft,
        relations: Array.from({ length: 129 }, () => validRelation),
        templateBindings: Array.from({ length: 33 }, () => ({
          templateVersionId: uuid(2),
        })),
        capabilityBindings: Array.from({ length: 33 }, () => ({
          capabilityKey: 'cms.content.article',
          capabilityVersion: '1',
        })),
      }).success,
    ).toBe(false);

    expect(
      PropsSchemaSnapshotSchema.safeParse({
        schemaVersion: '1',
        fields: Array.from({ length: 128 }, (_, index) => ({
          name: `field_${index + 1}`,
          kind: 'short_text',
          required: false,
        })),
        additionalProperties: false,
      }).success,
    ).toBe(true);
    expect(
      PropsSchemaSnapshotSchema.safeParse({
        schemaVersion: '1',
        fields: Array.from({ length: 129 }, (_, index) => ({
          name: `field_${index + 1}`,
          kind: 'short_text',
          required: false,
        })),
        additionalProperties: false,
      }).success,
    ).toBe(false);

    expect(
      FieldConstraintsSchema.safeParse({
        enumValues: Array.from({ length: 257 }, () => 'x'),
      }).success,
    ).toBe(false);
    expect(
      FieldConstraintsSchema.safeParse({ minLength: 1, maxLength: 0 }).success,
    ).toBe(false);

    const malformedSignatures = [
      '',
      'A'.repeat(85) + '==',
      'A'.repeat(87) + '==',
      'A'.repeat(86) + '=',
      'A'.repeat(86) + '++',
      'A'.repeat(43) + '-'.repeat(43) + '==',
      `${'A'.repeat(85)}\n==`,
      `é${'A'.repeat(85)}==`,
    ];
    for (const candidate of malformedSignatures)
      expect(CmsEd25519SignatureSchema.safeParse(candidate).success).toBe(
        false,
      );
    expect(CmsEd25519SignatureSchema.safeParse(signature).success).toBe(true);
    expect(
      ReleaseEnvelopeHeadersSchema.safeParse({
        keyId: 'release-key-1',
        issuedAt: '2026-09-02T12:00:00.000Z',
        nonce: uuid(3),
        signature,
      }).success,
    ).toBe(true);

    for (const candidate of [
      '"0"',
      '"9223372036854775808"',
      'W/"1"',
      '"1" OR 1=1',
      `"${'9'.repeat(10_000)}"`,
    ])
      expect(CmsStrongEtagSchema.safeParse(candidate).success).toBe(false);
  });

  it('[P2-S09-AC-214, P2-S09-AC-216] preserves safe error bounds and rejects duplicate/ambiguous query inputs', () => {
    const nestedDetails: Record<string, unknown> = { value: 'safe' };
    let nested: Record<string, unknown> = nestedDetails;
    for (let depth = 0; depth < 5; depth++) nested = { child: nested };
    for (const details of [
      nested,
      Object.fromEntries(
        Array.from({ length: 17 }, (_, index) => [`key${index}`, true]),
      ),
      { value: 'x'.repeat(8_193) },
    ])
      expect(
        ApiErrorSchema.safeParse({
          code: 'INVALID_REQUEST',
          message: 'The value is invalid.',
          requestId: uuid(4),
          details,
        }).success,
      ).toBe(false);

    const query = new Request(
      'https://api.example.test/api/v1/cms/content-types?limit=25&limit=26',
    );
    expect(new URL(query.url).searchParams.getAll('limit')).toHaveLength(2);
    expect(
      ContentSchemaRegistryListQuerySchema.safeParse({
        limit: '25',
        ownerId: uuid(5),
      }).success,
    ).toBe(false);
    expect(
      ContentSchemaRegistryDetailParamsSchema.safeParse({
        contentTypeId: uuid(6),
        versionId: uuid(7),
        projection: 'private.*',
      }).success,
    ).toBe(false);
    expect(
      SchemaActivationRequestSchema.safeParse({
        expectedVersion: '1',
        dryRunId: uuid(8),
        approvalIds: [uuid(9), uuid(9)],
        migrationPlanId: null,
      }).success,
    ).toBe(false);
    expect(
      FieldDefinitionInputSchema.safeParse({
        ...validField(10),
        defaultMode: 'none',
        defaultValue: { '<script>': 'expression' },
      }).success,
    ).toBe(false);
    expect(
      FieldSchemaChangeRequestSchema.safeParse({
        ...validFieldChange,
        key: 'bad key',
      }).success,
    ).toBe(false);
    expect(
      RelationBindingRequestSchema.safeParse({
        ...validRelation,
        targetType: 'bad type',
      }).success,
    ).toBe(false);
    expect(
      BlockRegistrationRequestSchema.safeParse({
        ...validBlock,
        releaseDigest: 'bad',
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-217] parses a maximum 128-field definition within the Tier 2 unit-test budget', () => {
    const definition = {
      ...validDraft,
      fields: Array.from({ length: 128 }, (_, index) => validField(index + 1)),
    };
    const startedAt = performance.now();
    const parsed = ContentTypeDraftRequestSchema.safeParse(definition);
    const durationMs = performance.now() - startedAt;
    expect(parsed.success).toBe(true);
    expect(durationMs).toBeLessThan(1_200);
  });
});

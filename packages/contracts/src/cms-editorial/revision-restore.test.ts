import { describe, expect, it } from 'vitest';

import {
  REVISION_RESTORE_SEAMS,
  RevisionRestoreForbiddenAuthoritySchema,
  RevisionRestoreHeadersSchema,
  RevisionRestorePathParamsSchema,
  RevisionRestoreRequestSchema,
  RevisionRestoreVerificationSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const uuid4 = '123e4567-e89b-42d3-a456-426614174003';

const validRequest = {
  entryId: uuid,
  revisionId: uuid2,
  migrationChainId: uuid3,
  expectedVersion: '7',
} as const;

const validRegistry = {
  revisionId: uuid2,
  migrationChainId: uuid3,
  sourceSchemaVersionId: uuid,
  activeSchemaVersionId: uuid4,
  chainSchemaVersionIds: [uuid, uuid4],
  entryVersion: '7',
} as const;

const validVerification = {
  request: validRequest,
  registry: validRegistry,
  seams: [...REVISION_RESTORE_SEAMS],
} as const;

describe('CMS-03B-04 revision restore request', () => {
  it('accepts the canonical body and rejects unknown keys', () => {
    expect(RevisionRestoreRequestSchema.safeParse(validRequest).success).toBe(
      true,
    );
    expect(
      RevisionRestoreRequestSchema.safeParse({
        ...validRequest,
        sourceSchemaVersionId: uuid,
      }).success,
    ).toBe(false);
  });

  it('requires the migration chain id and positive versions', () => {
    expect(
      RevisionRestoreRequestSchema.safeParse({
        ...validRequest,
        migrationChainId: undefined,
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreRequestSchema.safeParse({
        ...validRequest,
        revisionId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreRequestSchema.safeParse({
        ...validRequest,
        expectedVersion: '0',
      }).success,
    ).toBe(false);
  });

  it('binds exactly the entry and revision path parameters', () => {
    expect(
      RevisionRestorePathParamsSchema.safeParse({
        entryId: uuid,
        revisionId: uuid2,
      }).success,
    ).toBe(true);
    expect(
      RevisionRestorePathParamsSchema.safeParse({ entryId: uuid }).success,
    ).toBe(false);
    expect(
      RevisionRestorePathParamsSchema.safeParse({
        entryId: uuid,
        revisionId: uuid2,
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('requires JSON, an idempotency key, and an exact strong If-Match', () => {
    const headers = {
      contentType: 'application/json',
      idempotencyKey: 'abcdefgh',
      ifMatch: '"2"',
    };
    expect(RevisionRestoreHeadersSchema.safeParse(headers).success).toBe(true);
    expect(
      RevisionRestoreHeadersSchema.safeParse({ ...headers, ifMatch: 'W/"2"' })
        .success,
    ).toBe(false);
    expect(
      RevisionRestoreHeadersSchema.safeParse({
        contentType: 'application/json',
        ifMatch: '"2"',
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreHeadersSchema.safeParse({
        ...headers,
        idempotencyKey: 'abcdefg',
      }).success,
    ).toBe(false);
  });

  it('never accepts caller-supplied authority', () => {
    expect(RevisionRestoreForbiddenAuthoritySchema.safeParse({}).success).toBe(
      true,
    );
    expect(
      RevisionRestoreForbiddenAuthoritySchema.safeParse({ capability: 'edit' })
        .success,
    ).toBe(false);
  });
});

describe('CMS-03B-04 revision restore verification', () => {
  it('locks eight unique seam names', () => {
    expect(REVISION_RESTORE_SEAMS).toHaveLength(8);
    expect(new Set(REVISION_RESTORE_SEAMS).size).toBe(8);
  });

  it('accepts migration-bound evidence and rejects a fabricated seam list', () => {
    expect(
      RevisionRestoreVerificationSchema.safeParse(validVerification).success,
    ).toBe(true);
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        seams: ['entry_version_cas'],
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        seams: Array.from({ length: 8 }, () => 'entry_version_cas'),
      }).success,
    ).toBe(false);
  });

  it('rejects evidence that disagrees with the request', () => {
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, revisionId: uuid },
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, migrationChainId: uuid },
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, entryVersion: '99' },
      }).success,
    ).toBe(false);
  });

  it('requires a chain that spans source schema to active schema', () => {
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, chainSchemaVersionIds: [uuid4] },
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: {
          ...validRegistry,
          chainSchemaVersionIds: [uuid, uuid3],
        },
      }).success,
    ).toBe(false);
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, chainSchemaVersionIds: [] },
      }).success,
    ).toBe(false);
  });

  it('admits a 64-edge chain (65 named schema versions) and refuses a 66th', () => {
    // A chain of at most 64 completed plan edges (BE03b D6) names the source
    // schema version plus one version per edge: 65 versions at the bound.
    const chain = (count: number): string[] => [
      uuid,
      ...Array.from(
        { length: count - 2 },
        (_unused, index) =>
          `123e4567-e89b-42d3-a456-${String(index + 1).padStart(12, '0')}`,
      ),
      uuid4,
    ];
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, chainSchemaVersionIds: chain(65) },
      }).success,
    ).toBe(true);
    expect(
      RevisionRestoreVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, chainSchemaVersionIds: chain(66) },
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  CONFLICT_RESOLUTION_SEAMS,
  ConflictChoiceSchema,
  ConflictResolutionForbiddenAuthoritySchema,
  ConflictResolutionHeadersSchema,
  ConflictResolutionPathParamsSchema,
  ConflictResolutionRequestSchema,
  ConflictResolutionVerificationSchema,
  ConflictYoursSourceEvidenceSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const hash = 'a'.repeat(64);
const pointer = '/fields/' + uuid3;

const validRequest = {
  entryId: uuid,
  conflictId: uuid2,
  baseRevision: '3',
  choices: [{ path: pointer, choice: 'theirs' }],
  expectedVersion: '7',
} as const;

const validRegistry = {
  conflictId: uuid2,
  conflictVersion: '4',
  conflictHash: hash,
  baseRevision: '3',
  baseRevisionId: uuid,
  theirsRevisionId: uuid3,
  entryVersion: '7',
  changedPaths: [pointer],
  yours: { source: 'revision', yoursRevisionId: uuid3 },
} as const;

const validVerification = {
  request: validRequest,
  registry: validRegistry,
  seams: [...CONFLICT_RESOLUTION_SEAMS],
} as const;

describe('CMS-03B-02 conflict choice', () => {
  it('accepts a named choice without a value and an explicit choice with one', () => {
    expect(
      ConflictChoiceSchema.safeParse({ path: pointer, choice: 'base' }).success,
    ).toBe(true);
    expect(
      ConflictChoiceSchema.safeParse({
        path: pointer,
        choice: 'explicit',
        value: { title: 'Winner' },
      }).success,
    ).toBe(true);
  });

  it('rejects a named choice that smuggles a value', () => {
    for (const choice of ['base', 'theirs', 'yours'] as const) {
      expect(
        ConflictChoiceSchema.safeParse({ path: pointer, choice, value: 1 })
          .success,
      ).toBe(false);
    }
  });

  it('rejects an explicit choice without a value and any unknown key', () => {
    expect(
      ConflictChoiceSchema.safeParse({ path: pointer, choice: 'explicit' })
        .success,
    ).toBe(false);
    expect(
      ConflictChoiceSchema.safeParse({
        path: pointer,
        choice: 'base',
        side: 'theirs',
      }).success,
    ).toBe(false);
    expect(
      ConflictChoiceSchema.safeParse({ path: 'not-a-pointer', choice: 'base' })
        .success,
    ).toBe(false);
    expect(
      ConflictChoiceSchema.safeParse({ path: pointer, choice: 'nearest' })
        .success,
    ).toBe(false);
  });

  it('declares the editorial bound on an explicit replacement value', () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let level = 0; level < 9; level += 1) deep = { child: deep };
    expect(
      ConflictChoiceSchema.safeParse({
        path: pointer,
        choice: 'explicit',
        value: deep,
      }).success,
    ).toBe(false);
    const oversized = { blob: 'x'.repeat(262_145) };
    expect(
      ConflictChoiceSchema.safeParse({
        path: pointer,
        choice: 'explicit',
        value: oversized,
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03B-02 conflict resolution request', () => {
  it('accepts the canonical body and rejects an invented yours-side field', () => {
    expect(
      ConflictResolutionRequestSchema.safeParse(validRequest).success,
    ).toBe(true);
    expect(
      ConflictResolutionRequestSchema.safeParse({
        ...validRequest,
        yoursSource: 'revision',
      }).success,
    ).toBe(false);
  });

  it('requires 1-128 choices and rejects a path decided twice', () => {
    expect(
      ConflictResolutionRequestSchema.safeParse({
        ...validRequest,
        choices: [],
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionRequestSchema.safeParse({
        ...validRequest,
        choices: Array.from({ length: 129 }, (_, index) => ({
          path: '/p/' + String(index),
          choice: 'base',
        })),
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionRequestSchema.safeParse({
        ...validRequest,
        choices: [
          { path: pointer, choice: 'base' },
          { path: pointer, choice: 'theirs' },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects malformed ids and non-positive versions', () => {
    expect(
      ConflictResolutionRequestSchema.safeParse({
        ...validRequest,
        conflictId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionRequestSchema.safeParse({
        ...validRequest,
        baseRevision: '0',
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionRequestSchema.safeParse({
        ...validRequest,
        expectedVersion: '9223372036854775808',
      }).success,
    ).toBe(false);
  });

  it('binds exactly the entry and conflict path parameters', () => {
    expect(
      ConflictResolutionPathParamsSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
      }).success,
    ).toBe(true);
    expect(
      ConflictResolutionPathParamsSchema.safeParse({ entryId: uuid }).success,
    ).toBe(false);
    expect(
      ConflictResolutionPathParamsSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
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
    expect(ConflictResolutionHeadersSchema.safeParse(headers).success).toBe(
      true,
    );
    expect(
      ConflictResolutionHeadersSchema.safeParse({
        ...headers,
        ifMatch: 'W/"2"',
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionHeadersSchema.safeParse({ ...headers, ifMatch: '2' })
        .success,
    ).toBe(false);
    expect(
      ConflictResolutionHeadersSchema.safeParse({
        ...headers,
        idempotencyKey: 'abcdefg',
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: 'abcdefgh',
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionHeadersSchema.safeParse({
        ...headers,
        extra: 'x',
      }).success,
    ).toBe(false);
  });

  it('never accepts caller-supplied authority', () => {
    expect(
      ConflictResolutionForbiddenAuthoritySchema.safeParse({}).success,
    ).toBe(true);
    expect(
      ConflictResolutionForbiddenAuthoritySchema.safeParse({ owner: uuid })
        .success,
    ).toBe(false);
  });
});

describe('CMS-03B-02 yours-side source evidence', () => {
  it('accepts a revision reference and a hash-only proposed candidate', () => {
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'revision',
        yoursRevisionId: uuid3,
      }).success,
    ).toBe(true);
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'proposed',
        yoursRevisionId: null,
        proposedValuesHash: hash,
      }).success,
    ).toBe(true);
  });

  it('refuses a proposed candidate that also names a revision id', () => {
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'proposed',
        yoursRevisionId: uuid3,
        proposedValuesHash: hash,
      }).success,
    ).toBe(false);
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'proposed',
        yoursRevisionId: null,
      }).success,
    ).toBe(false);
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'revision',
        yoursRevisionId: null,
      }).success,
    ).toBe(false);
    expect(
      ConflictYoursSourceEvidenceSchema.safeParse({
        source: 'proposed',
        yoursRevisionId: null,
        proposedValuesHash: hash,
        proposedValues: { title: 'draft' },
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03B-02 conflict resolution verification', () => {
  it('locks eight unique seam names', () => {
    expect(CONFLICT_RESOLUTION_SEAMS).toHaveLength(8);
    expect(new Set(CONFLICT_RESOLUTION_SEAMS).size).toBe(8);
  });

  it('accepts a registry-bound attestation and rejects a fabricated seam list', () => {
    expect(
      ConflictResolutionVerificationSchema.safeParse(validVerification).success,
    ).toBe(true);
    expect(
      ConflictResolutionVerificationSchema.safeParse({
        ...validVerification,
        seams: ['conflict_version_cas'],
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionVerificationSchema.safeParse({
        ...validVerification,
        seams: Array.from({ length: 8 }, () => 'conflict_version_cas'),
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionVerificationSchema.safeParse({
        ...validVerification,
        registry: {
          ...validRegistry,
          yours: { source: 'proposed', yoursRevisionId: null },
        },
      }).success,
    ).toBe(false);
  });

  it('rejects registry evidence that disagrees with the request', () => {
    expect(
      ConflictResolutionVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, conflictId: uuid },
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, baseRevision: '9' },
      }).success,
    ).toBe(false);
    expect(
      ConflictResolutionVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, entryVersion: '99' },
      }).success,
    ).toBe(false);
  });

  it('rejects a choice outside the recorded divergent paths', () => {
    expect(
      ConflictResolutionVerificationSchema.safeParse({
        ...validVerification,
        registry: { ...validRegistry, changedPaths: ['/fields/' + uuid] },
      }).success,
    ).toBe(false);
  });
});

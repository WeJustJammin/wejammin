import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_CONFLICT_RESOLVE_OPERATION,
  CmsEditorialConflictResolveChoiceSchema,
  CmsEditorialConflictResolveHeadersSchema,
  CmsEditorialConflictResolveRequestSchema,
  CmsEditorialConflictResolvePathSchema,
  CmsEditorialConflictResolveResourceSchema,
  cmsEditorialConflictResolveRetainsIdempotencyKey,
} from './cms-editorial-conflict-resolve';
import {
  CONFLICT_ID,
  ENTRY_ID,
  PARENT_A,
  PARENT_B,
  resolvedResource,
  theirsChoice,
  validRequest,
} from './cms-editorial-conflict-resolve-test-support';

describe('CmsEditorialConflictResolve contract projection', () => {
  it('describes the locked CMS-03B-02 operation', () => {
    expect(CMS_EDITORIAL_CONFLICT_RESOLVE_OPERATION.operationId).toBe(
      'CMS-03B-02',
    );
    expect(CMS_EDITORIAL_CONFLICT_RESOLVE_OPERATION.method).toBe('POST');
    expect(CMS_EDITORIAL_CONFLICT_RESOLVE_OPERATION.path).toBe(
      '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
    );
    expect(CMS_EDITORIAL_CONFLICT_RESOLVE_OPERATION.status).toBe(201);
    expect(CMS_EDITORIAL_CONFLICT_RESOLVE_OPERATION.browserPolicy).toBe(
      'human-form',
    );
  });

  it('accepts the four explicit choices and rejects an invented one', () => {
    for (const choice of ['base', 'theirs', 'yours', 'explicit'] as const)
      expect(
        CmsEditorialConflictResolveChoiceSchema.safeParse({
          path: theirsChoice.path,
          choice,
          ...(choice === 'explicit' ? { value: 'typed' } : {}),
        }).success,
      ).toBe(true);
    expect(
      CmsEditorialConflictResolveChoiceSchema.safeParse({
        ...theirsChoice,
        choice: 'largest',
      }).success,
    ).toBe(false);
  });

  it('requires a value for explicit and forbids one for named choices', () => {
    expect(
      CmsEditorialConflictResolveChoiceSchema.safeParse({
        path: theirsChoice.path,
        choice: 'explicit',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialConflictResolveChoiceSchema.safeParse({
        ...theirsChoice,
        value: 'smuggled',
      }).success,
    ).toBe(false);
  });

  it('requires at least one choice with unique paths', () => {
    expect(
      CmsEditorialConflictResolveRequestSchema.safeParse(validRequest).success,
    ).toBe(true);
    expect(
      CmsEditorialConflictResolveRequestSchema.safeParse({
        ...validRequest,
        choices: [],
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialConflictResolveRequestSchema.safeParse({
        ...validRequest,
        choices: [theirsChoice, theirsChoice],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown request fields', () => {
    expect(
      CmsEditorialConflictResolveRequestSchema.safeParse({
        ...validRequest,
        winner: 'yours',
      }).success,
    ).toBe(false);
  });

  it('binds the path to entry and conflict UUIDs', () => {
    expect(
      CmsEditorialConflictResolvePathSchema.safeParse({
        entryId: ENTRY_ID,
        conflictId: CONFLICT_ID,
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialConflictResolvePathSchema.safeParse({
        entryId: 'not-a-uuid',
        conflictId: CONFLICT_ID,
      }).success,
    ).toBe(false);
  });

  it('requires JSON content type, idempotency key, and quoted If-Match', () => {
    expect(
      CmsEditorialConflictResolveHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: '0d9c1c2a-6f4f-4cde-9a3e-111111111111',
        ifMatch: '"7"',
      }).success,
    ).toBe(true);
    expect(
      CmsEditorialConflictResolveHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: '0d9c1c2a-6f4f-4cde-9a3e-111111111111',
        ifMatch: '7',
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialConflictResolveHeadersSchema.safeParse({
        contentType: 'text/plain',
        idempotencyKey: '0d9c1c2a-6f4f-4cde-9a3e-111111111111',
        ifMatch: '"7"',
      }).success,
    ).toBe(false);
  });

  it('validates the two-parent success resource for the resolved entry', () => {
    const parsed =
      CmsEditorialConflictResolveResourceSchema.safeParse(resolvedResource);
    expect(parsed.success).toBe(true);
    // The shared schema bounds parentRevisionIds at two; the transport
    // additionally requires exactly two distinct parents before success.
    expect(
      CmsEditorialConflictResolveResourceSchema.safeParse({
        ...resolvedResource,
        parentRevisionIds: [PARENT_A, PARENT_B, ENTRY_ID],
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialConflictResolveResourceSchema.safeParse({
        ...resolvedResource,
        entryId: PARENT_A,
      }).success,
    ).toBe(true);
  });

  it('keeps the idempotency key only while the outcome is uncertain', () => {
    expect(cmsEditorialConflictResolveRetainsIdempotencyKey('unknown')).toBe(
      true,
    );
    expect(
      cmsEditorialConflictResolveRetainsIdempotencyKey('rate-limited'),
    ).toBe(true);
    expect(cmsEditorialConflictResolveRetainsIdempotencyKey('degraded')).toBe(
      true,
    );
    expect(cmsEditorialConflictResolveRetainsIdempotencyKey('conflict')).toBe(
      false,
    );
    expect(cmsEditorialConflictResolveRetainsIdempotencyKey('success')).toBe(
      false,
    );
  });
});

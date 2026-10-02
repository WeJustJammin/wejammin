import { describe, expect, it } from 'vitest';

import {
  RevisionHistoryChangeSchema,
  RevisionHistoryCompareSchema,
  RevisionHistoryPageSchema,
  RevisionHistoryPathParamsSchema,
  RevisionHistoryQuerySchema,
  RevisionSummarySchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
const pointer = '/fields/' + uuid3;

const validSummary = {
  id: uuid,
  revisionNumber: '4',
  locale: 'en-US',
  state: 'draft',
  contentHash: hash,
  createdAt: instant,
  authorClass: 'human-author',
} as const;

const validPage = {
  items: [validSummary],
  nextCursor: null,
  pageVersion: '4',
  compare: null,
} as const;

const validCompare = {
  leftRevisionId: uuid,
  rightRevisionId: uuid2,
  changes: [
    { path: pointer, kind: 'changed', leftHash: hash, rightHash: hash },
  ],
} as const;

describe('CMS-03B-03 revision summary and page', () => {
  it('accepts a strict summary row and rejects leakage or bad states', () => {
    expect(RevisionSummarySchema.safeParse(validSummary).success).toBe(true);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, ownerId: uuid })
        .success,
    ).toBe(false);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, state: 'archived' })
        .success,
    ).toBe(false);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, contentHash: 'short' })
        .success,
    ).toBe(false);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, authorClass: '' })
        .success,
    ).toBe(false);
  });

  it('accepts a nullable cursor and compare block and rejects unknown keys', () => {
    expect(RevisionHistoryPageSchema.safeParse(validPage).success).toBe(true);
    expect(
      RevisionHistoryPageSchema.safeParse({
        ...validPage,
        compare: validCompare,
      }).success,
    ).toBe(true);
    expect(
      RevisionHistoryPageSchema.safeParse({ ...validPage, nextCursor: null })
        .success,
    ).toBe(true);
    expect(
      RevisionHistoryPageSchema.safeParse({
        ...validPage,
        items: Array.from({ length: 51 }, () => validSummary),
      }).success,
    ).toBe(false);
    expect(
      RevisionHistoryPageSchema.safeParse({ ...validPage, extra: 1 }).success,
    ).toBe(false);
  });

  it('accepts a populated compare block and its closed change kinds', () => {
    expect(RevisionHistoryCompareSchema.safeParse(validCompare).success).toBe(
      true,
    );
    for (const kind of ['added', 'removed', 'changed', 'unchanged'] as const) {
      expect(
        RevisionHistoryChangeSchema.safeParse({
          path: pointer,
          kind,
          leftHash: null,
          rightHash: null,
        }).success,
      ).toBe(true);
    }
    expect(
      RevisionHistoryChangeSchema.safeParse({ path: pointer, kind: 'moved' })
        .success,
    ).toBe(false);
    expect(
      RevisionHistoryCompareSchema.safeParse({
        ...validCompare,
        changes: Array.from({ length: 513 }, (_, index) => ({
          path: '/p/' + String(index),
          kind: 'unchanged',
        })),
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03B-03 revision history query', () => {
  it('defaults the window to 25 and rejects out-of-range limits', () => {
    expect(RevisionHistoryQuerySchema.parse({ entryId: uuid }).limit).toBe(25);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 1 }).success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 50 })
        .success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 0 }).success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 51 })
        .success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 1.5 })
        .success,
    ).toBe(false);
  });

  it('bounds the signed cursor at 512 characters and allows null', () => {
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        cursor: 'a'.repeat(512),
      }).success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        cursor: 'a'.repeat(513),
      }).success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, cursor: null })
        .success,
    ).toBe(true);
  });

  it('allowlists only state, locale, and compareRevisionId filters', () => {
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        state: 'published',
        locale: 'zh-Hant',
        compareRevisionId: uuid2,
      }).success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        state: 'archived',
      }).success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, ownerId: uuid })
        .success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        compareRevisionId: 'nope',
      }).success,
    ).toBe(false);
  });

  it('binds exactly one UUID path parameter', () => {
    expect(
      RevisionHistoryPathParamsSchema.safeParse({ entryId: uuid }).success,
    ).toBe(true);
    expect(
      RevisionHistoryPathParamsSchema.safeParse({ entryId: 'nope' }).success,
    ).toBe(false);
    expect(
      RevisionHistoryPathParamsSchema.safeParse({ entryId: uuid, extra: 1 })
        .success,
    ).toBe(false);
  });
});

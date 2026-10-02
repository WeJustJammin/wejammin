import { describe, expect, it } from 'vitest';

import {
  TaxonomyTermActionApiRequestSchema,
  TaxonomyTermActionHeadersSchema,
  TaxonomyTermActionRequestSchema,
  TaxonomyTermResourceSchema,
} from './taxonomy-term';

const TAXONOMY_ID = '10000000-0000-4000-8000-000000000001';
const TERM_ID = '20000000-0000-4000-8000-000000000002';
const SURVIVOR_ID = '30000000-0000-4000-8000-000000000003';
const HASH = 'a'.repeat(64);
const request = {
  taxonomyId: TAXONOMY_ID,
  action: 'create',
  termKey: 'vocal-range',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en-US', label: 'Vocal range' }],
  aliases: ['Voice range'],
  expectedVersion: '1',
};
const resource = {
  id: TERM_ID,
  version: '2',
  lifecycle: 'active',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  taxonomyId: TAXONOMY_ID,
  termId: TERM_ID,
  termKey: 'vocal-range',
  parentId: null,
  successorId: null,
};

describe('CMS-03C-03 taxonomy-term wire contract', () => {
  it('requires exact transport path, headers, and body without extra authority selectors', () => {
    const apiRequest = {
      taxonomyId: TAXONOMY_ID,
      headers: {
        contentType: 'application/json',
        idempotencyKey: 'taxonomy-action-0001',
        ifMatch: '"1"',
      },
      body: request,
    };
    expect(TaxonomyTermActionApiRequestSchema.parse(apiRequest)).toEqual(
      apiRequest,
    );
    for (const candidate of [
      { ...apiRequest, ownerId: TAXONOMY_ID },
      { ...apiRequest, taxonomyId: 'private' },
      {
        ...apiRequest,
        headers: { ...apiRequest.headers, ownerId: TAXONOMY_ID },
      },
      { ...apiRequest, body: { ...request, ownerId: TAXONOMY_ID } },
    ])
      expect(
        TaxonomyTermActionApiRequestSchema.safeParse(candidate).success,
      ).toBe(false);
  });

  it('accepts the five closed actions with a merge-only survivor', () => {
    for (const action of ['create', 'rename', 'alias', 'deprecate'])
      expect(
        TaxonomyTermActionRequestSchema.safeParse({
          ...request,
          action,
        }).success,
      ).toBe(true);
    expect(
      TaxonomyTermActionRequestSchema.parse({
        ...request,
        action: 'merge',
        survivorId: SURVIVOR_ID,
      }),
    ).toMatchObject({ action: 'merge', survivorId: SURVIVOR_ID });
  });

  it('rejects unknown fields, invented actions, invalid identity, keys, and versions', () => {
    for (const candidate of [
      { ...request, ownerId: TAXONOMY_ID },
      { ...request, taxonomyId: 'private' },
      { ...request, action: 'delete' },
      { ...request, termKey: 'Invalid.Key' },
      { ...request, termKey: 'vocal_range' },
      { ...request, parentId: 'private' },
      { ...request, expectedVersion: '0' },
      { ...request, action: 'merge' },
      { ...request, survivorId: SURVIVOR_ID },
    ])
      expect(TaxonomyTermActionRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('bounds localized labels and aliases', () => {
    for (const candidate of [
      { ...request, labels: [] },
      {
        ...request,
        labels: Array.from({ length: 65 }, () => ({
          locale: 'en',
          label: 'x',
        })),
      },
      { ...request, labels: [{ locale: 'not_a_locale', label: 'x' }] },
      { ...request, labels: [{ locale: 'en', label: '' }] },
      { ...request, labels: [{ locale: 'en', label: 'x'.repeat(161) }] },
      { ...request, labels: [{ locale: 'en', label: 'e\u0301' }] },
      {
        ...request,
        labels: [{ locale: 'en', label: 'x', privateValue: 'private' }],
      },
      { ...request, aliases: Array.from({ length: 65 }, () => 'x') },
      { ...request, aliases: [''] },
      { ...request, aliases: ['x'.repeat(161)] },
    ])
      expect(TaxonomyTermActionRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('requires JSON, idempotency, and strong version binding', () => {
    expect(
      TaxonomyTermActionHeadersSchema.parse({
        contentType: 'application/json',
        idempotencyKey: 'taxonomy-action-0001',
        ifMatch: '"1"',
      }),
    ).toMatchObject({ ifMatch: '"1"' });
    for (const headers of [
      {
        contentType: 'text/plain',
        idempotencyKey: 'taxonomy-action-0001',
        ifMatch: '"1"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'short',
        ifMatch: '"1"',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'taxonomy-action-0001',
      },
      {
        contentType: 'application/json',
        idempotencyKey: 'taxonomy-action-0001',
        ifMatch: 'W/"1"',
      },
    ])
      expect(TaxonomyTermActionHeadersSchema.safeParse(headers).success).toBe(
        false,
      );
  });

  it('accepts only the closed browser-safe term resource', () => {
    expect(TaxonomyTermResourceSchema.parse(resource)).toEqual(resource);
    expect(
      TaxonomyTermResourceSchema.parse({
        ...resource,
        lifecycle: 'merged',
        successorId: SURVIVOR_ID,
      }),
    ).toMatchObject({ lifecycle: 'merged', successorId: SURVIVOR_ID });
    for (const candidate of [
      { ...resource, ownerId: TAXONOMY_ID },
      { ...resource, lifecycle: 'deleted' },
      { ...resource, version: '0' },
      { ...resource, taxonomyId: 'private' },
      { ...resource, termId: 'private' },
      { ...resource, termKey: 'Private.Term' },
      { ...resource, termKey: 'vocal_range' },
      { ...resource, successorId: 'private' },
      { ...resource, contentHash: 'private' },
    ])
      expect(TaxonomyTermResourceSchema.safeParse(candidate).success).toBe(
        false,
      );
  });
});

import { describe, expect, it } from 'vitest';
import type {
  TaxonomyTermActionRequest,
  TaxonomyTermResource,
} from '@wejammin/contracts';

import { validTerm } from './taxonomy-contracts';

/**
 * The CMS-03C-03 success is the TERM row (`platform_private.cms_term_resource`, 20261014120200): its `version` is the
 * term's own row version (1 on create, +1 on every later action), NOT the vocabulary's active TaxonomyVersion
 * `expectedVersion` the If-Match carries (BE03c 1380, D1); `parentId` is the stored parent (only create and rename
 * apply the requested one, D3) and `lifecycle` is the stored lifecycle (a deprecated term can still be renamed or
 * aliased, BE03c 1377).
 */
const taxonomyId = 'd1200000-0000-4000-8000-000000000001';
const termId = 'd1200000-0000-4000-8000-000000000002';
const parentId = 'd1200000-0000-4000-8000-000000000005';
const survivorId = 'd1200000-0000-4000-8000-000000000006';

const request = (
  overrides: Partial<TaxonomyTermActionRequest> = {},
): TaxonomyTermActionRequest => ({
  taxonomyId,
  action: 'create',
  termKey: 'jazz-fusion',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
  aliases: [],
  expectedVersion: '7',
  ...overrides,
});

const term = (
  overrides: Partial<TaxonomyTermResource> = {},
): TaxonomyTermResource => ({
  id: termId,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-14T04:00:00.000Z',
  updatedAt: '2026-10-14T04:00:00.000Z',
  lifecycle: 'active',
  taxonomyId,
  termId,
  termKey: 'jazz-fusion',
  parentId: null,
  successorId: null,
  ...overrides,
});

describe('validTerm binds the real CMS-03C-03 term answer', () => {
  it('create: version 1 whatever the vocabulary version, active, the requested parent, no successor', () => {
    const body = request({ action: 'create', parentId });
    expect(validTerm(term({ parentId }), body)).toBe(true);
    expect(validTerm(term({ parentId, version: '2' }), body)).toBe(false);
    expect(validTerm(term({ parentId: null }), body)).toBe(false);
    expect(validTerm(term({ parentId, lifecycle: 'deprecated' }), body)).toBe(
      false,
    );
    expect(validTerm(term({ parentId, successorId: survivorId }), body)).toBe(
      false,
    );
  });

  it.each(['rename', 'alias'] as const)(
    '%s: a later term version (not expectedVersion + 1), active or deprecated, no successor',
    (action) => {
      const body = request({ action, expectedVersion: '7' });
      expect(validTerm(term({ version: '2' }), body)).toBe(true);
      expect(validTerm(term({ version: '5' }), body)).toBe(true);
      expect(
        validTerm(term({ version: '2', lifecycle: 'deprecated' }), body),
      ).toBe(true);
      // a first version is a create, never the result of a later action
      expect(validTerm(term({ version: '1' }), body)).toBe(false);
      expect(
        validTerm(
          term({ version: '2', lifecycle: 'merged', successorId: survivorId }),
          body,
        ),
      ).toBe(false);
      expect(
        validTerm(term({ version: '2', successorId: survivorId }), body),
      ).toBe(false);
    },
  );

  it('rename applies the requested parent; alias keeps the stored parent whatever was requested', () => {
    const rename = request({ action: 'rename', parentId });
    expect(validTerm(term({ version: '2', parentId }), rename)).toBe(true);
    expect(validTerm(term({ version: '2', parentId: null }), rename)).toBe(
      false,
    );
    const alias = request({ action: 'alias', parentId: null });
    expect(validTerm(term({ version: '2', parentId }), alias)).toBe(true);
    expect(validTerm(term({ version: '2', parentId: null }), alias)).toBe(true);
  });

  it('deprecate: deprecated, a later version, the stored parent, no successor', () => {
    const body = request({ action: 'deprecate' });
    expect(
      validTerm(term({ version: '2', lifecycle: 'deprecated' }), body),
    ).toBe(true);
    expect(
      validTerm(
        term({ version: '3', lifecycle: 'deprecated', parentId }),
        body,
      ),
    ).toBe(true);
    expect(validTerm(term({ version: '2', lifecycle: 'active' }), body)).toBe(
      false,
    );
    expect(
      validTerm(term({ version: '1', lifecycle: 'deprecated' }), body),
    ).toBe(false);
  });

  it('merge: merged, a later version, the requested survivor as the successor', () => {
    const body = request({ action: 'merge', survivorId });
    const merged = term({
      version: '2',
      lifecycle: 'merged',
      successorId: survivorId,
    });
    expect(validTerm(merged, body)).toBe(true);
    expect(validTerm({ ...merged, parentId }, body)).toBe(true);
    expect(validTerm({ ...merged, successorId: parentId }, body)).toBe(false);
    expect(validTerm({ ...merged, successorId: null }, body)).toBe(false);
    expect(validTerm({ ...merged, lifecycle: 'active' }, body)).toBe(false);
  });

  it('always binds the vocabulary, the term identity and the key to the request', () => {
    const body = request({ action: 'rename' });
    expect(validTerm(term({ version: '2', taxonomyId: termId }), body)).toBe(
      false,
    );
    expect(validTerm(term({ version: '2', id: taxonomyId }), body)).toBe(false);
    expect(validTerm(term({ version: '2', termKey: 'other-key' }), body)).toBe(
      false,
    );
    expect(
      validTerm({ ...term({ version: '2' }), ownerId: taxonomyId }, body),
    ).toBe(false);
  });
});

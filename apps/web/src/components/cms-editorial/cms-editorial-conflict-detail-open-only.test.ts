import { describe, expect, it, vi } from 'vitest';

import { forwardCmsEditorialConflictDetailRead } from '../../server/cms-editorial-platform-reads';
import { executeCmsEditorialConflictDetailRead } from './cms-editorial-conflict-detail-transport';
import { conflictDetailBody } from './cms-editorial-conflict-fixtures.test-support';
import {
  ENTRY_ID,
  CONFLICT_ID,
  TITLE,
} from './cms-editorial-editor-fixtures.test-support';

/**
 * BE03b DEC-139: CMS-03B-12 serves only an `open` conflict (a closed one is the
 * concealed 404). A 200 that carries a closed state, a resolved revision or no
 * divergent paths is a contract violation by the dependency: the web proxy
 * answers 502 and the browser client never reports it as a success.
 */

const ORIGIN = 'https://app.example.test';
const PATH = `/api/v1/cms/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`;

const open = () =>
  conflictDetailBody({
    paths: [
      {
        fieldId: TITLE,
        base: { value: 'Base' },
        theirs: { value: 'Theirs' },
        yours: { value: 'Yours' },
      },
    ],
  }) as unknown as Record<string, unknown> & {
    conflict: Record<string, unknown>;
  };

const violations: ReadonlyArray<readonly [string, () => unknown]> = [
  [
    'resolved',
    () => {
      const body = open();
      body.conflict.state = 'resolved';
      return body;
    },
  ],
  [
    'superseded',
    () => {
      const body = open();
      body.conflict.state = 'superseded';
      return body;
    },
  ],
  [
    'open with a resolved revision',
    () => ({ ...open(), resolvedRevisionId: ENTRY_ID }),
  ],
  ['open with no paths', () => ({ ...open(), paths: [] })],
  [
    'a missing side that carries a value',
    () => {
      const body = open() as unknown as {
        paths: Array<{ base: Record<string, unknown> }>;
      };
      body.paths[0]!.base = {
        value: 'hidden',
        provenance: 'missing',
        valueHash: null,
      };
      return body;
    },
  ],
  [
    'an explicit-null side that carries a value',
    () => {
      const body = open() as unknown as {
        paths: Array<{ yours: Record<string, unknown> }>;
      };
      body.paths[0]!.yours = {
        value: 'hidden',
        provenance: 'explicit_null',
        valueHash: null,
      };
      return body;
    },
  ],
  [
    'duplicate paths',
    () => {
      const body = open() as unknown as { paths: unknown[] };
      body.paths = [body.paths[0], body.paths[0]];
      return body;
    },
  ],
  [
    'paths that are not the changed paths',
    () => {
      const body = open();
      body.conflict.changedPaths = [
        '/fields/018f0c45-73fe-7dc2-9c09-68f7ecf19999',
      ];
      return body;
    },
  ],
];

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('conflict detail: only an open conflict is a success', () => {
  it('accepts the open conflict (control)', async () => {
    const result = await executeCmsEditorialConflictDetailRead({
      basePath: '/api/v1/cms/entries',
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      fetcher: async () => json(open()),
    });
    expect(result.outcome).toBe('success');
  });

  for (const [name, body] of violations) {
    it(`the browser client does not treat a 200 with a ${name} payload as a success`, async () => {
      const result = await executeCmsEditorialConflictDetailRead({
        basePath: '/api/v1/cms/entries',
        entryId: ENTRY_ID,
        conflictId: CONFLICT_ID,
        fetcher: async () => json(body()),
      });
      expect(result.outcome).not.toBe('success');
      expect(result.resource).toBeNull();
    });

    it(`the web proxy answers 502 for a 200 with a ${name} payload`, async () => {
      const upstream = {
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify(body()), {
              status: 200,
              headers: {
                'content-type': 'application/json',
                etag: `"${ENTRY_ID}:3:4:${'a'.repeat(64)}"`,
              },
            }),
        ),
      };
      const response = await forwardCmsEditorialConflictDetailRead(
        new Request(ORIGIN + PATH, { method: 'GET' }),
        ENTRY_ID,
        CONFLICT_ID,
        upstream,
      );
      expect(response.status).toBe(502);
      const text = await response.text();
      expect(text).not.toContain('resolved');
      expect(text).not.toContain('superseded');
    });
  }
});

// @vitest-environment jsdom

/**
 * The CMS-06 conflict controller over a taxonomy context (BE03b CMS-03B-02 and
 * CMS-03B-12; BE03c CMS-03C-17). Two boundaries are bound here:
 *
 * - The selector refresh token moves only for a verified `422 VALIDATION_FAILED`
 *   whose reason token is `term_unavailable`. A 400 (which also maps to
 *   `validation`) and a 415 that carry the same token, and any other 422 reason,
 *   must leave it untouched, and no refusal is ever resent on its own.
 * - When a 409 makes the form re-read the conflict, the new revision is adopted
 *   only while the server-read `theirs` reference is the one the taxonomy scope
 *   was bound to. A re-read that names a different revision id, number, schema
 *   version or hash is not verified: every path, operand and choice is kept,
 *   exactly as the failed-reload path already does.
 *
 * These drive the REAL controller and the REAL conflict transports through the
 * injected fetcher; no module is mocked.
 */

import { type ConflictDetailResource } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { termUid } from '../cms-editorial-fields/cms-taxonomy-field-fixtures.test-support';
import { createCmsEditorialConflictController } from './cms-editorial-conflict-controller';
import { COPY } from './cms-editorial-conflict-copy';
import {
  GUITAR,
  TOPICS,
  detailResponse,
  namedTermRefusal,
  taxonomyInit,
  taxonomyPaths,
  termUnavailable,
  unrelatedRefusal,
} from './conflict-taxonomy-fixtures.test-support';
import { TITLE, apiError } from './cms-editorial-editor-fixtures.test-support';

type TheirsRef = ConflictDetailResource['theirs'];

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | null;
}

const setup = (steps: readonly (Response | Error)[]) => {
  const queue = [...steps];
  const calls: Call[] = [];
  const onResolved = vi.fn();
  const controller = createCmsEditorialConflictController({
    init: taxonomyInit(),
    csrfToken: () => 'csrf-token',
    newKey: (() => {
      let n = 0;
      return () => `resolve-key-${++n}`;
    })(),
    onResolved,
    fetcher: async (input, requestInit) => {
      calls.push({
        url: String(input),
        method: requestInit?.method ?? 'GET',
        headers: new Headers(requestInit?.headers),
        body: typeof requestInit?.body === 'string' ? requestInit.body : null,
      });
      const step = queue.shift();
      if (step === undefined) throw new Error(`unexpected ${String(input)}`);
      if (step instanceof Error) throw step;
      return step;
    },
  });
  return { controller, calls, onResolved };
};

const chooseEveryPath = (
  controller: ReturnType<typeof createCmsEditorialConflictController>,
): void => {
  controller.choose(TITLE, 'yours');
  controller.choose(TOPICS, 'explicit');
  controller.setExplicit(TOPICS, { termIds: [GUITAR] });
};

const verifiedRefusals: ReadonlyArray<[number, string]> = [
  [400, 'INVALID_REQUEST'],
  [415, 'UNSUPPORTED_MEDIA_TYPE'],
];

describe('conflict controller: the taxonomy refresh boundary', () => {
  it('refreshes the selector only for a verified 422 term_unavailable, keeping the choice', async () => {
    const { controller, calls } = setup([termUnavailable()]);
    chooseEveryPath(controller);
    await controller.submit();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('POST');
    expect(controller.getState().phase).toBe('invalid');
    expect(controller.getState().taxonomyRefreshToken).toBe(1);
    expect(controller.getState().choices[TOPICS]).toEqual({
      choice: 'explicit',
      explicit: { termIds: [GUITAR] },
    });
  });

  it.each(verifiedRefusals)(
    'does not refresh the selector for a verified %i %s that still names term_unavailable',
    async (status, code) => {
      const { controller, calls } = setup([namedTermRefusal(status, code)]);
      chooseEveryPath(controller);
      await controller.submit();
      expect(calls).toHaveLength(1);
      expect(calls[0]!.method).toBe('POST');
      expect(controller.getState().phase).toBe('invalid');
      expect(controller.getState().taxonomyRefreshToken).toBe(0);
    },
  );

  it('does not refresh the selector for a verified 422 that names another reason', async () => {
    const { controller, calls } = setup([unrelatedRefusal()]);
    chooseEveryPath(controller);
    await controller.submit();
    expect(calls).toHaveLength(1);
    expect(controller.getState().phase).toBe('invalid');
    expect(controller.getState().taxonomyRefreshToken).toBe(0);
  });
});

describe('conflict controller: a 409 re-read over a taxonomy context', () => {
  const mismatchedTheirs: Array<[string, Partial<TheirsRef>]> = [
    ['revision ID', { revisionId: fieldUuid(0x803) }],
    ['revision number', { revisionNumber: '9' }],
    ['schema version ID', { schemaVersionId: fieldUuid(0x804) }],
    ['content hash', { contentHash: 'b'.repeat(64) }],
  ];

  it.each(mismatchedTheirs)(
    'keeps every operand and choice when the re-read names a different theirs %s',
    async (_member, theirs) => {
      const { controller, calls } = setup([
        apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
        detailResponse({ entryVersion: '8', theirs }),
      ]);
      chooseEveryPath(controller);
      const before = controller.getState();
      await controller.submit();
      const after = controller.getState();
      expect(calls[1]).toMatchObject({ method: 'GET' });
      expect(after).toMatchObject({
        phase: 'idle',
        alert: true,
        message: COPY.reloadFailed,
      });
      expect(after.entryVersion).toBe(before.entryVersion);
      expect(after.baseRevision).toBe(before.baseRevision);
      expect(after.paths).toEqual(before.paths);
      expect(after.choices[TITLE]).toEqual({
        choice: 'yours',
        explicit: null,
      });
      expect(after.choices[TOPICS]).toEqual({
        choice: 'explicit',
        explicit: { termIds: [GUITAR] },
      });
      expect(after.refusedFieldIds).toEqual([]);
    },
  );

  it('adopts a re-read whose theirs reference matches: the new version is taken and a changed path resets', async () => {
    const { controller, calls } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      detailResponse({
        entryVersion: '8',
        paths: [
          taxonomyPaths[0]!,
          {
            ...taxonomyPaths[1]!,
            theirs: { value: { termIds: [termUid(7)] } },
          },
        ],
      }),
    ]);
    chooseEveryPath(controller);
    await controller.submit();
    const after = controller.getState();
    expect(calls[1]).toMatchObject({ method: 'GET' });
    expect(after).toMatchObject({
      phase: 'idle',
      alert: false,
      entryVersion: '8',
    });
    expect(after.choices[TITLE]).toEqual({ choice: 'yours', explicit: null });
    expect(after.choices[TOPICS]?.choice).toBeNull();
    expect(after.message).toContain('changed while you were choosing');
  });
});

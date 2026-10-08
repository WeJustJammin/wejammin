// @vitest-environment jsdom

/**
 * Slice 10 evidence lane EA (AC-014): every dependency failure of the CMS-03B-02 resolution
 * (500, 502, 503, 504, network) is recoverable from the three-way form without losing a choice:
 * the form states that the outcome is unconfirmed in fixed copy (never the server text), keeps
 * every choice, and the retry replays the identical request under the same Idempotency-Key.
 */
import { ConflictDetailResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { createCmsEditorialConflictController } from './cms-editorial-conflict-controller';
import { conflictDetailBody } from './cms-editorial-conflict-fixtures.test-support';
import { conflictInitFrom } from './cms-editorial-conflict-state';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  INSTANT,
  TITLE,
  apiError,
  editorFields,
  json,
} from './cms-editorial-editor-fixtures.test-support';

type Step = Response | Error;

const init = () =>
  conflictInitFrom(
    ConflictDetailResourceSchema.parse(
      conflictDetailBody({
        paths: [
          {
            fieldId: TITLE,
            base: { value: 'Base title' },
            theirs: { value: 'Their title' },
            yours: { value: 'My title' },
          },
          {
            fieldId: BLURB,
            base: { value: null },
            theirs: { value: 'Their blurb' },
            yours: { value: 'My blurb' },
          },
        ],
      }),
    ),
    editorFields(),
  );

const resolved = () =>
  json(
    201,
    {
      id: fieldUuid(0x703),
      version: '1',
      entryVersion: '7',
      createdAt: INSTANT,
      updatedAt: INSTANT,
      state: 'draft',
      entryId: ENTRY_ID,
      revisionNumber: '4',
      schemaVersionId: fieldUuid(0x710),
      templateVersionId: null,
      taxonomyVersionIds: [],
      locale: 'en-US',
      contentHash: HASH,
      parentRevisionIds: [fieldUuid(0x701), fieldUuid(0x702)],
      validationState: 'valid',
      conflictId: CONFLICT_ID,
    },
    { etag: '"7"', 'cache-control': 'no-store' },
  );

const setup = (steps: readonly Step[]) => {
  const queue = [...steps];
  const calls: Array<{ headers: Headers; body: string | null }> = [];
  const onResolved = vi.fn();
  const controller = createCmsEditorialConflictController({
    init: init(),
    csrfToken: () => 'csrf-token',
    newKey: (() => {
      let n = 0;
      return () => `resolve-key-${++n}`;
    })(),
    onResolved,
    fetcher: async (_input, requestInit) => {
      calls.push({
        headers: new Headers(requestInit?.headers),
        body: typeof requestInit?.body === 'string' ? requestInit.body : null,
      });
      const step = queue.shift();
      if (step === undefined) throw new Error('unexpected request');
      if (step instanceof Error) throw step;
      return step;
    },
  });
  return { controller, calls, onResolved };
};

const failures: ReadonlyArray<readonly [string, Step]> = [
  ['a 500 INTERNAL_ERROR', apiError(500, 'INTERNAL_ERROR')],
  ['a 502 BAD_GATEWAY', apiError(502, 'BAD_GATEWAY')],
  ['a 503 DEPENDENCY_UNAVAILABLE', apiError(503, 'DEPENDENCY_UNAVAILABLE')],
  ['a 504 GATEWAY_TIMEOUT', apiError(504, 'GATEWAY_TIMEOUT')],
  ['a network failure', new TypeError('Failed to fetch')],
];

describe('EA conflict resolution recovers from every dependency failure', () => {
  it.each(failures)(
    '%s keeps every choice, shows fixed copy and the retry replays the identical request under the same key',
    async (_label, failure) => {
      const { controller, calls, onResolved } = setup([failure, resolved()]);
      controller.choose(TITLE, 'theirs');
      controller.choose(BLURB, 'yours');
      await controller.submit();
      const state = controller.getState();
      expect(state.phase).toBe('unknown');
      expect(state.message).not.toContain('Server text');
      expect(state.choices[TITLE]?.choice).toBe('theirs');
      expect(state.choices[BLURB]?.choice).toBe('yours');
      expect(onResolved).not.toHaveBeenCalled();

      await controller.retryReconcile();
      expect(calls).toHaveLength(2);
      expect(calls[1]?.headers.get('idempotency-key')).toBe(
        calls[0]?.headers.get('idempotency-key'),
      );
      expect(calls[1]?.body).toBe(calls[0]?.body);
      expect(onResolved).toHaveBeenCalledTimes(1);
      expect(controller.getState().phase).toBe('resolved');
    },
  );
});

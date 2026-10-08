// @vitest-environment jsdom

import { ConflictDetailResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { createCmsEditorialConflictController } from './cms-editorial-conflict-controller';
import {
  conflictDetailBody,
  type ConflictPathOptions,
} from './cms-editorial-conflict-fixtures.test-support';
import { conflictInitFrom } from './cms-editorial-conflict-state';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  INSTANT,
  RATING,
  TITLE,
  apiError,
  draftDetail,
  editorFields,
  json,
} from './cms-editorial-editor-fixtures.test-support';

type Step = Response | Error;

const twoPaths: readonly ConflictPathOptions[] = [
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
];

const init = (paths: readonly ConflictPathOptions[] = twoPaths) =>
  conflictInitFrom(
    ConflictDetailResourceSchema.parse(conflictDetailBody({ paths })),
    editorFields(),
  );

const resolved = (parents = [fieldUuid(0x701), fieldUuid(0x702)]) =>
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
      parentRevisionIds: parents,
      validationState: 'valid',
      conflictId: CONFLICT_ID,
    },
    { etag: '"7"', 'cache-control': 'no-store' },
  );

const setup = (steps: readonly Step[], start = init()) => {
  const queue = [...steps];
  const calls: Array<{
    url: string;
    method: string;
    headers: Headers;
    body: string | null;
  }> = [];
  const onResolved = vi.fn();
  const controller = createCmsEditorialConflictController({
    init: start,
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

const bodyOf = (call: { body: string | null } | undefined) =>
  JSON.parse(call?.body ?? '{}') as Record<string, unknown>;

describe('conflict controller: choices', () => {
  it('starts with no choice made and never infers a winner', () => {
    const { controller } = setup([]);
    for (const choice of Object.values(controller.getState().choices))
      expect(choice.choice).toBeNull();
    expect(controller.getState().phase).toBe('idle');
  });

  it('refuses to submit until every path has an explicit choice, naming the ones left open', async () => {
    const { controller, calls } = setup([]);
    controller.choose(TITLE, 'theirs');
    await controller.submit();
    expect(calls).toHaveLength(0);
    expect(controller.getState()).toMatchObject({
      phase: 'invalid',
      refusedFieldIds: [BLURB],
    });
    expect(controller.getState().summaryToken).toBe(1);
  });

  it('validates an explicit value with the field own rules before any request', async () => {
    const { controller, calls } = setup(
      [],
      init([
        {
          fieldId: RATING,
          base: { value: 3 },
          theirs: { value: 4 },
          yours: { value: 5 },
        },
      ]),
    );
    controller.choose(RATING, 'explicit');
    controller.setExplicit(RATING, 11);
    await controller.submit();
    expect(calls).toHaveLength(0);
    expect(controller.getState().refusedFieldIds).toEqual([RATING]);
  });
});

describe('conflict controller: resolve', () => {
  it('posts every choice verbatim with key + If-Match on the entry version, and opens the entry', async () => {
    const { controller, calls, onResolved } = setup([resolved()]);
    controller.choose(TITLE, 'yours');
    controller.choose(BLURB, 'explicit');
    controller.setExplicit(BLURB, 'A merged blurb');
    await controller.submit();
    const call = calls[0]!;
    expect(call.url).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}/resolve`,
    );
    expect(call.headers.get('if-match')).toBe('"6"');
    expect(call.headers.get('idempotency-key')).toBe('resolve-key-1');
    expect(call.headers.get('x-csrf-token')).toBe('csrf-token');
    expect(bodyOf(call)).toEqual({
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      baseRevision: '2',
      expectedVersion: '6',
      choices: [
        { path: `/fields/${TITLE}`, choice: 'yours' },
        {
          path: `/fields/${BLURB}`,
          choice: 'explicit',
          value: 'A merged blurb',
        },
      ],
    });
    expect(controller.getState().phase).toBe('resolved');
    expect(onResolved).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
      expect.objectContaining({
        kind: 'resolved',
        entryId: ENTRY_ID,
        revisionNumber: '4',
        state: 'draft',
        migrationChainId: null,
        edgeCount: null,
      }),
    );
  });

  it('never sends an explicit value alongside a named choice', async () => {
    const { controller, calls } = setup([resolved()]);
    controller.choose(TITLE, 'explicit');
    controller.setExplicit(TITLE, 'Typed then abandoned');
    controller.choose(TITLE, 'theirs');
    controller.choose(BLURB, 'base');
    await controller.submit();
    const choices = bodyOf(calls[0]).choices as Array<Record<string, unknown>>;
    expect(choices).toEqual([
      { path: `/fields/${TITLE}`, choice: 'theirs' },
      { path: `/fields/${BLURB}`, choice: 'base' },
    ]);
  });

  it('after a lost response keeps the key and replays the identical request on retry', async () => {
    const { controller, calls, onResolved } = setup([
      new TypeError('Failed to fetch'),
      resolved(),
    ]);
    controller.choose(TITLE, 'theirs');
    controller.choose(BLURB, 'theirs');
    await controller.submit();
    expect(controller.getState().phase).toBe('unknown');
    expect(controller.getState().message).toContain('could not be confirmed');
    await controller.retryReconcile();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.headers.get('idempotency-key')).toBe(
      calls[0]!.headers.get('idempotency-key'),
    );
    expect(calls[1]!.body).toBe(calls[0]!.body);
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('rejects a 201 that is not a distinct two-parent revision as unknown, never as resolved', async () => {
    const { controller, onResolved } = setup([
      resolved([fieldUuid(0x701), fieldUuid(0x701)]),
    ]);
    controller.choose(TITLE, 'theirs');
    controller.choose(BLURB, 'theirs');
    await controller.submit();
    expect(controller.getState().phase).toBe('unknown');
    expect(onResolved).not.toHaveBeenCalled();
  });
});

describe('conflict controller: 409 and closure', () => {
  const changedDetail = () =>
    json(
      200,
      conflictDetailBody({
        entryVersion: '8',
        baseRevision: '2',
        paths: [
          twoPaths[0]!,
          {
            fieldId: BLURB,
            base: { value: null },
            theirs: { value: 'Their blurb, edited again' },
            yours: { value: 'My blurb' },
          },
        ],
      }),
      { 'cache-control': 'no-store' },
    );

  it('on a 409 refetches the conflict and keeps choices only for paths whose preimages are unchanged', async () => {
    const { controller, calls } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      changedDetail(),
    ]);
    controller.choose(TITLE, 'yours');
    controller.choose(BLURB, 'theirs');
    await controller.submit();
    expect(calls[1]).toMatchObject({
      method: 'GET',
      url: `/api/v1/cms/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
    });
    const state = controller.getState();
    expect(state.choices[TITLE]?.choice).toBe('yours');
    expect(state.choices[BLURB]?.choice).toBeNull();
    expect(state.refusedFieldIds).toEqual([BLURB]);
    expect(state.entryVersion).toBe('8');
    expect(state.phase).toBe('idle');
    expect(state.message).toContain('changed while you were choosing');
  });

  it('treats a 404 after a 409 as the conflict no longer being open and refetches the draft', async () => {
    const { controller, calls } = setup([
      apiError(409, 'CONFLICT'),
      apiError(404, 'NOT_FOUND'),
      draftDetail({
        entryVersion: '9',
        revisionNumber: '5',
        values: { [TITLE]: 'Final' },
      }),
    ]);
    controller.choose(TITLE, 'yours');
    controller.choose(BLURB, 'yours');
    await controller.submit();
    expect(calls[2]).toMatchObject({
      method: 'GET',
      url: `/api/v1/cms/entries/${ENTRY_ID}`,
    });
    expect(controller.getState()).toMatchObject({
      phase: 'closed',
      alert: true,
    });
    expect(controller.getState().message).toContain('no longer open');
    // It does not say why: closed, resolved and hidden are one answer.
    expect(controller.getState().message).not.toMatch(
      /resolved|superseded|hidden/iu,
    );
    await controller.submit();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });

  it('treats a 404 on the resolve itself the same way', async () => {
    const { controller } = setup([
      apiError(404, 'NOT_FOUND'),
      draftDetail({
        entryVersion: '9',
        revisionNumber: '5',
        values: { [TITLE]: 'x' },
      }),
    ]);
    controller.choose(TITLE, 'yours');
    controller.choose(BLURB, 'yours');
    await controller.submit();
    expect(controller.getState().phase).toBe('closed');
  });
});

describe('conflict controller: refusals keep the choices', () => {
  it.each([
    [401, 'UNAUTHENTICATED', 'unauthenticated', 'Sign in again'],
    [403, 'FORBIDDEN', 'denied', 'cannot resolve'],
  ])(
    'maps a %i to %s without discarding a choice',
    async (status, code, phase, copy) => {
      const { controller } = setup([apiError(status, code)]);
      controller.choose(TITLE, 'theirs');
      controller.choose(BLURB, 'yours');
      await controller.submit();
      expect(controller.getState().phase).toBe(phase);
      expect(controller.getState().message).toContain(copy);
      expect(controller.getState().choices[TITLE]?.choice).toBe('theirs');
      expect(controller.getState().choices[BLURB]?.choice).toBe('yours');
    },
  );

  it('maps a typed 422 to the choice it names and fixed copy', async () => {
    const { controller } = setup([
      apiError(422, 'VALIDATION_FAILED', {
        reasonCode: 'rich_text_not_canonical',
        violations: [
          { path: '/choices/1/value', code: 'invalid_value', message: 'x' },
        ],
      }),
    ]);
    controller.choose(TITLE, 'theirs');
    controller.choose(BLURB, 'explicit');
    controller.setExplicit(BLURB, 'ok');
    await controller.submit();
    const state = controller.getState();
    expect(state.phase).toBe('invalid');
    expect(state.refusedFieldIds).toEqual([BLURB]);
    expect(state.message).toContain('rich text');
    expect(state.message).not.toContain('Server text');
  });

  it('states a rate limit with the wait and lets the author submit again', async () => {
    const { controller, calls } = setup([
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 9 },
        { 'retry-after': '9' },
      ),
      resolved(),
    ]);
    controller.choose(TITLE, 'theirs');
    controller.choose(BLURB, 'theirs');
    await controller.submit();
    expect(controller.getState()).toMatchObject({
      phase: 'waiting',
      retryAfterSeconds: 9,
    });
    await controller.submit();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2);
    expect(controller.getState().phase).toBe('resolved');
  });
});

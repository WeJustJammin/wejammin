import { describe, expect, it, vi } from 'vitest';

import {
  READS,
  WRITES,
  apiError,
  bindingWith,
  bodyOf,
  read,
  uuid,
  uuid2,
  validCreateBody,
  write,
  conflictBody,
} from './cms-editorial-platform-hardening.test-support';
import { forwardCmsEditorialConflictResolution } from './cms-editorial-platform-conflict';
import { forwardCmsEditorialEntryCreateMutation } from './cms-editorial-platform-mutation';
import {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialConflictDetailRead,
  forwardCmsEditorialEntryDraftDetailRead,
  forwardCmsEditorialEntryListRead,
  forwardCmsEditorialRevisionHistoryRead,
} from './cms-editorial-platform-reads';

/**
 * Item 2 of the Slice 10 web boundary hardening: `request.signal` into every
 * upstream call, the Worker's `details.violations` shape for local Zod
 * failures, and 400 for a malformed path or query value (DEC-145).
 */

describe('client cancellation reaches the Worker binding', () => {
  it.each([...WRITES, ...READS])(
    '$name passes request.signal into the upstream request',
    async ({ call }) => {
      const controller = new AbortController();
      const binding = bindingWith(async () => apiError(500, 'INTERNAL_ERROR'));
      await call(binding, controller.signal);
      const upstream = vi.mocked(binding.fetch).mock.calls[0]?.[0] as Request;
      expect(upstream.signal.aborted).toBe(false);
      controller.abort('client closed');
      expect(upstream.signal.aborted).toBe(true);
    },
  );
});

describe('local validation failures publish the Worker violation shape', () => {
  it('[P2-S10-AC-005] create reports an unknown field and a bad locale as bounded pointers', async () => {
    const fetch = vi.fn();
    const body = JSON.parse(validCreateBody) as Record<string, unknown>;
    const response = await forwardCmsEditorialEntryCreateMutation(
      write('/api/v1/cms/entries', { ...body, ownerId: 'x', locale: 'x' }),
      { fetch },
    );
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
    const details = (await bodyOf(response)).details as {
      violations: readonly { path: string; code: string; message: string }[];
    };
    expect(details.violations).toEqual(
      expect.arrayContaining([
        {
          path: '/ownerId',
          code: 'unknown_field',
          message: 'The value is invalid.',
        },
        expect.objectContaining({
          path: '/locale',
          message: 'The value is invalid.',
        }),
      ]),
    );
    expect(JSON.stringify(details)).not.toContain('"x"');
  });

  it('[P2-S10-AC-011] a conflict choice that is not a field pointer is a /choices pointer', async () => {
    const response = await forwardCmsEditorialConflictResolution(
      write(
        `/api/v1/cms/entries/${uuid}/conflicts/${uuid2}/resolve`,
        {
          ...conflictBody,
          choices: [{ path: '/fields/title', choice: 'theirs' }],
        },
        { 'if-match': '"1"' },
      ),
      uuid,
      uuid2,
      { fetch: vi.fn() },
    );
    expect(response.status).toBe(422);
    const details = (await bodyOf(response)).details as {
      violations: readonly { path: string; code: string }[];
    };
    expect(details.violations[0]).toMatchObject({
      path: '/choices/0/path',
      code: 'field_pointer_invalid',
    });
  });
});

describe('a malformed path or query value is a 400 INVALID_REQUEST (DEC-145)', () => {
  const never = () => bindingWith(async () => apiError(500, 'INTERNAL_ERROR'));

  it.each([
    [
      'draft detail path',
      () =>
        forwardCmsEditorialEntryDraftDetailRead(
          read('/api/v1/cms/entries/not-a-uuid'),
          never(),
          'not-a-uuid',
        ),
    ],
    [
      'history path',
      () =>
        forwardCmsEditorialRevisionHistoryRead(
          read('/api/v1/cms/entries/not-a-uuid/revisions'),
          never(),
          'not-a-uuid',
        ),
    ],
    [
      'conflict detail path',
      () =>
        forwardCmsEditorialConflictDetailRead(
          read(`/api/v1/cms/entries/${uuid}/conflicts/nope`),
          uuid,
          'nope',
          never(),
        ),
    ],
    [
      'draft detail locale',
      () =>
        forwardCmsEditorialEntryDraftDetailRead(
          read(`/api/v1/cms/entries/${uuid}?locale=${'x'.repeat(40)}`),
          never(),
          uuid,
        ),
    ],
    [
      'entry list state',
      () =>
        forwardCmsEditorialEntryListRead(
          read('/api/v1/cms/entries?state=not-a-state'),
          never(),
        ),
    ],
    [
      'entry list contentTypeId',
      () =>
        forwardCmsEditorialEntryListRead(
          read('/api/v1/cms/entries?contentTypeId=nope'),
          never(),
        ),
    ],
    [
      'authoring context version',
      () =>
        forwardCmsEditorialAuthoringContextRead(
          read(
            '/api/v1/cms/entries/authoring-context?contentTypeVersionId=nope',
          ),
          never(),
        ),
    ],
  ])('%s', async (_label, call) => {
    const response = await call();
    expect(response.status).toBe(400);
    expect((await bodyOf(response)).code).toBe('INVALID_REQUEST');
  });
});

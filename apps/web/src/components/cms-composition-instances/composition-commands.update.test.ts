import { describe, expect, it, vi } from 'vitest';

import { submitUpdate } from './composition-commands';
import { id, row } from './composition.test-support';
import { acceptRequest, detachRequests } from './composition-update-request';
import { diffOf, plainPath } from './composition.test-support';

/*
 * CMS-03C-02 (place) and CMS-03C-15 (accept or detach) commands from the browser (FE03 1114, 1115; DEC-193). A 2xx is
 * believed only when it is the answer to THIS request: the browser repeats the structural binding the proxy checked.
 */
const as = (fn: unknown) => fn as typeof fetch;
const json = (body: unknown, status: number, etag?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) },
  });
const refusal = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
) =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId: 'r',
      details,
    }),
    { status },
  );
const ctx = (fetcher: typeof fetch) => ({
  csrfToken: 'csrf',
  idempotencyKey: 'key-0001-0001',
  fetcher,
});

describe('submitUpdate: an accept or detach answered by this request', () => {
  const diff = diffOf(1, [plainPath('/n')]);
  const accept = acceptRequest(diff, {}, '9');
  if (accept === null) throw new Error('fixture');
  const answered = (rows: unknown[], etag = '"10"') =>
    json({ items: rows }, 200, etag);

  it('returns the appended rows and the entry version one higher', async () => {
    const fetcher = vi.fn(async () =>
      answered([row(1, { version: '4', patternVersion: 2 })]),
    );
    const answer = await submitUpdate(accept, ctx(as(fetcher)));
    expect(answer).toMatchObject({ kind: 'updated', version: '10' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/compositions/pattern-updates');
    expect((init.headers as Record<string, string>)['if-match']).toBe('"9"');
    expect(JSON.parse(init.body as string)).toEqual(accept);
  });

  it('names each outcome: the new pin, a removal, or a local copy (DEC-193)', async () => {
    const rows = [
      row(1, { version: '4', patternVersion: 2 }),
      row(2, { version: '4', state: 'retired', patternVersion: 1 }),
      row(3, { version: '4', linkMode: 'detached', patternVersion: 1 }),
    ];
    const three = {
      action: 'accept' as const,
      targetPatternVersion: 2,
      instances: [1, 2, 3].map((n) => ({
        instanceId: id(n),
        expectedVersion: '3',
        choices: [],
      })),
      expectedVersion: '9',
    };
    const answer = await submitUpdate(
      three,
      ctx(as(async () => answered(rows))),
    );
    expect(answer.kind === 'updated' && answer.outcomes).toEqual([
      { instanceId: id(1), text: 'Now on pattern version 2' },
      { instanceId: id(2), text: 'Removed from the entry' },
      { instanceId: id(3), text: 'Local copy' },
    ]);
  });

  it('names a detach as a local copy', async () => {
    const [request] = detachRequests(
      [{ instanceId: id(1), expectedVersion: '3' }],
      '9',
    );
    const answer = await submitUpdate(
      request!,
      ctx(
        as(async () =>
          answered([row(1, { version: '4', linkMode: 'detached' })]),
        ),
      ),
    );
    expect(answer.kind === 'updated' && answer.outcomes[0]?.text).toBe(
      'Local copy',
    );
  });

  it.each([
    ['the wrong number of rows', answered([])],
    [
      'a row that is not the next instance version',
      answered([row(1, { version: '9' })]),
    ],
    [
      'an ETag that is not the entry version plus one',
      answered([row(1, { version: '4' })], '"12"'),
    ],
  ])('treats %s as an unknown outcome', async (_name, response) => {
    expect(await submitUpdate(accept, ctx(as(async () => response)))).toEqual({
      kind: 'uncertain',
    });
  });

  it('keeps the typed 409 reasons that preserve the author choices', async () => {
    for (const reason of ['diff_has_collisions', 'revision_not_editable']) {
      expect(
        await submitUpdate(
          accept,
          ctx(
            as(async () =>
              refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
                reasonCode: reason,
              }),
            ),
          ),
        ),
      ).toMatchObject({ kind: 'refused', status: 409, reason });
    }
  });
});

import { describe, expect, it } from 'vitest';

import { parseJsonBody, readJsonBodyText } from './boundary';

/*
 * The JSON body read is bounded by a deadline signal (BE00 step 2). Each way
 * the read can end, early or late, is answered with the same stable refusal.
 */

const MAX_BODY_BYTES = 256 * 1024;

const JSON_REQUEST = (text: () => Promise<string>): Request => {
  const request = new Request('https://api.wejammin.test/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  Object.defineProperty(request, 'text', { value: text });
  return request;
};

/** A signal whose `aborted` flips to true on the Nth read. */
const abortsOnRead = (nth: number): AbortSignal => {
  let reads = 0;
  return {
    get aborted() {
      reads += 1;
      return reads >= nth;
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as AbortSignal;
};

const timeout = {
  ok: false,
  status: 504,
  code: 'UPSTREAM_TIMEOUT',
};

describe('readJsonBodyText with a deadline signal', () => {
  it('answers 504 when the deadline passed before the read began', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      await readJsonBodyText(
        JSON_REQUEST(() => Promise.resolve('{}')),
        controller.signal,
      ),
    ).toMatchObject(timeout);
  });

  it('answers 504 when the deadline passes while the body is still arriving', async () => {
    const controller = new AbortController();
    const pending = readJsonBodyText(
      JSON_REQUEST(() => new Promise<string>(() => undefined)),
      controller.signal,
    );
    controller.abort();
    expect(await pending).toMatchObject(timeout);
  });

  it('answers 400 when the body stream cannot be opened', async () => {
    const result = await readJsonBodyText(
      JSON_REQUEST(() => {
        throw new Error('locked');
      }),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('answers 400 when the body stream fails mid-read', async () => {
    const result = await readJsonBodyText(
      JSON_REQUEST(() => Promise.reject(new Error('reset'))),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('answers 504 when the deadline passes between the read and the size check', async () => {
    expect(
      await readJsonBodyText(
        JSON_REQUEST(() => Promise.resolve('{}')),
        abortsOnRead(3),
      ),
    ).toMatchObject(timeout);
  });

  it('answers 504 when the deadline passes after the size check', async () => {
    expect(
      await readJsonBodyText(
        JSON_REQUEST(() => Promise.resolve('{}')),
        abortsOnRead(4),
      ),
    ).toMatchObject(timeout);
  });

  it('answers 413 for a streamed body over the ceiling', async () => {
    expect(
      await readJsonBodyText(
        JSON_REQUEST(() => Promise.resolve('x'.repeat(MAX_BODY_BYTES + 1))),
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });
});

describe('parseJsonBody with a deadline signal', () => {
  it('answers 504 before it reads anything when the deadline already passed', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      await parseJsonBody(
        JSON_REQUEST(() => Promise.resolve('{}')),
        { safeParse: (value) => ({ success: true, data: value }) },
        controller.signal,
      ),
    ).toMatchObject(timeout);
  });
});

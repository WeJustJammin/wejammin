import { describe, expect, it } from 'vitest';

import { EntryRevisionRequestSchema } from '@wejammin/contracts';

import { parseJsonBody, readBytes } from './admission-body';

describe('CMS editorial bounded body admission', () => {
  it('rejects malformed UTF-8 before schema parsing instead of replacing bytes', async () => {
    const bytes = new Uint8Array([
      0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d,
    ]);
    const request = new Request('https://api.example.test/cms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bytes,
    });
    const result = await parseJsonBody(request, EntryRevisionRequestSchema);
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('cancels and refuses a streamed body over the 256 KiB cap', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(262_145));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request('https://api.example.test/cms', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const result = await readBytes(request);
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(cancelled).toBe(true);
  });

  it('rejects a declared over-cap body before consuming it', async () => {
    const request = new Request('https://api.example.test/cms', {
      method: 'POST',
      headers: { 'content-length': '262145' },
      body: '{}',
    });
    expect(await readBytes(request)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(request.bodyUsed).toBe(false);
  });

  it('accepts an empty stream and a nonnumeric declared length within the byte cap', async () => {
    const empty = new Request('https://api.example.test/cms', {
      method: 'POST',
    });
    const emptyResult = await readBytes(empty);
    expect(emptyResult.ok && emptyResult.value.byteLength).toBe(0);

    const malformedLength = new Request('https://api.example.test/cms', {
      method: 'POST',
      headers: { 'content-length': 'unknown' },
      body: '{}',
    });
    const result = await readBytes(malformedLength);
    expect(result.ok && new TextDecoder().decode(result.value)).toBe('{}');
  });

  it('cancels a pending body read when its deadline signal aborts', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request('https://api.example.test/cms', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const controller = new AbortController();
    const pending = readBytes(request, controller.signal);
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, status: 400 });
    expect(cancelled).toBe(true);
  });

  it('refuses an already-aborted signal before reading the body', async () => {
    const request = new Request('https://api.example.test/cms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const controller = new AbortController();
    controller.abort();
    expect(
      await parseJsonBody(
        request,
        EntryRevisionRequestSchema,
        controller.signal,
      ),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('fails closed when a body stream errors', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('stream failed'));
      },
    });
    const request = new Request('https://api.example.test/cms', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect(await readBytes(request)).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects a non-JSON media type and a malformed schema result', async () => {
    const media = new Request('https://api.example.test/cms', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    expect(
      await parseJsonBody(media, EntryRevisionRequestSchema),
    ).toMatchObject({
      ok: false,
      status: 415,
    });

    const malformedSchema = new Request('https://api.example.test/cms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(
      await parseJsonBody(malformedSchema, { safeParse: () => ({}) }),
    ).toMatchObject({ ok: false, status: 422 });
  });
});

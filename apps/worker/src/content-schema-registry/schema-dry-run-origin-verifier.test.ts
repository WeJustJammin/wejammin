import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import type { MigrationWorkerPort } from './migration-worker-types';
import {
  CmsSchemaDryRunOriginRequestSchema,
  type CmsSchemaDryRunOriginRequest,
} from './schema-dry-run-origin-request';
import { createCmsSchemaDryRunOriginVerifier } from './schema-dry-run-origin-verifier';

const CAUSE = '50000000-0000-4000-8000-000000000005';
const event = (
  causationId: string | null = null,
): CmsSchemaDryRunOriginRequest['requestedEvent'] => ({
  eventId: '30000000-0000-4000-8000-000000000003',
  eventType: 'job.requested',
  schemaVersion: 1,
  aggregateType: 'job',
  aggregateId: '10000000-0000-4000-8000-000000000001',
  aggregateVersion: '9223372036854775799',
  correlationId: '40000000-0000-4000-8000-000000000004',
  causationId,
});
const setup = (response: unknown = true) => {
  const call = vi.fn<MigrationWorkerPort['call']>(async () => response);
  return {
    call,
    signal: new AbortController().signal,
    verifier: createCmsSchemaDryRunOriginVerifier({ port: { call } }),
  };
};
const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;
const descriptors = (value: object) =>
  Reflect.ownKeys(value).map((key) => ({
    key,
    descriptor: Object.getOwnPropertyDescriptor(value, key),
  }));
// Independent descriptor records include constructor; pair arrays avoid its
// special object-map equality behavior. Traverse caller children and prototypes.
const snapshot = (root: unknown) => {
  const seen = new Set<object>();
  const nodes: {
    value: object;
    prototype: unknown;
    properties: ReturnType<typeof descriptors>;
    frozen: boolean;
    extensible: boolean;
  }[] = [];
  const visit = (value: unknown): void => {
    if (!isObject(value) || seen.has(value)) return;
    seen.add(value);
    const prototype: unknown = Object.getPrototypeOf(value);
    const properties = descriptors(value);
    nodes.push({
      value,
      prototype,
      properties,
      frozen: Object.isFrozen(value),
      extensible: Object.isExtensible(value),
    });
    for (const entry of properties) visit(entry.descriptor?.value);
    visit(prototype);
  };
  visit(root);
  return nodes;
};
const preserve = (root: unknown) => {
  const before = snapshot(root);
  return () => {
    const after = snapshot(root);
    expect(after.length).toBe(before.length);
    after.forEach((node, index) => {
      const old = before[index];
      expect(node.value === old?.value).toBe(true);
      expect(node.prototype === old?.prototype).toBe(true);
      expect(node.properties).toStrictEqual(old?.properties);
      node.properties.forEach((entry, position) => {
        expect(
          entry.descriptor?.value ===
            old?.properties[position]?.descriptor?.value,
        ).toBe(true);
      });
      expect(node.frozen).toBe(old?.frozen);
      expect(node.extensible).toBe(old?.extensible);
    });
  };
};
const assertCall = (
  f: ReturnType<typeof setup>,
  input: ReturnType<typeof event>,
) => {
  expect(f.call.mock.calls).toHaveLength(1);
  const invocation = f.call.mock.calls[0];
  if (invocation === undefined) throw new Error('Expected origin read');
  const [operation, request, signal] = invocation;
  expect(operation).toBe(SCHEMA_MIGRATION_RPC.readPlan);
  expect(signal === f.signal).toBe(true);
  const expected: CmsSchemaDryRunOriginRequest = {
    requestedEvent: { ...input },
  };
  expect(request).toStrictEqual(expected);
  expect(CmsSchemaDryRunOriginRequestSchema.safeParse(request).success).toBe(
    true,
  );
  if (!isObject(request) || !('requestedEvent' in request))
    throw new Error('Expected one-key origin request');
  expect(Reflect.ownKeys(request)).toStrictEqual(['requestedEvent']);
  expect(Object.isFrozen(request)).toBe(true);
  expect(Object.isFrozen(request.requestedEvent)).toBe(true);
  expect(request.requestedEvent === input).toBe(false);
};
const reject = async (input: unknown) => {
  const f = setup();
  const unchanged = preserve(input);
  await expect(f.verifier.verify(input, f.signal)).resolves.toBe(false);
  expect(f.call.mock.calls).toStrictEqual([]);
  unchanged();
};
const malformedFields: { key: string; value: unknown; label: string }[] = [
  { key: 'aggregateVersion', value: '1.2', label: 'decimal text' },
  { key: 'aggregateVersion', value: 1.2, label: 'decimal number' },
  { key: 'aggregateVersion', value: '0', label: 'zero' },
  { key: 'aggregateVersion', value: '01', label: 'leading zero' },
  { key: 'aggregateVersion', value: '-1', label: 'negative' },
  { key: 'aggregateVersion', value: '+1', label: 'plus sign' },
  { key: 'aggregateVersion', value: '1e2', label: 'exponent' },
  { key: 'aggregateVersion', value: ' 1', label: 'whitespace' },
  { key: 'aggregateVersion', value: '9223372036854775808', label: 'overflow' },
  { key: 'aggregateVersion', value: 1, label: 'number' },
  { key: 'eventId', value: 'not-a-uuid', label: 'malformed UUID' },
  {
    key: 'eventId',
    value: '00000000-0000-0000-0000-000000000000',
    label: 'nil UUID',
  },
  {
    key: 'eventId',
    value: 'ABCDEFAB-0000-4000-8000-000000000003',
    label: 'uppercase UUID',
  },
  { key: 'aggregateId', value: null, label: 'null aggregate UUID' },
  { key: 'correlationId', value: 'bad', label: 'correlation UUID' },
  { key: 'causationId', value: 'bad', label: 'causation UUID' },
  {
    key: 'eventType',
    value: 'cms.schema.activated',
    label: 'activation event',
  },
  { key: 'eventType', value: 'object.uploaded', label: 'non-job event' },
  { key: 'schemaVersion', value: 2, label: 'wrong schema' },
  { key: 'schemaVersion', value: '1', label: 'string schema' },
  { key: 'aggregateType', value: 'object', label: 'wrong aggregate' },
];

describe('private dry-run origin request and producer-facing verifier', () => {
  it.each([null, CAUSE])(
    'preserves the whole original event with causation %s',
    async (cause) => {
      const f = setup();
      const input = event(cause);
      const unchanged = preserve(input);
      await expect(f.verifier.verify(input, f.signal)).resolves.toBe(true);
      assertCall(f, input);
      unchanged();
    },
  );

  it('accepts a frozen original event without mutating it', async () => {
    const f = setup();
    const input = Object.freeze(event());
    const unchanged = preserve(input);
    await expect(f.verifier.verify(input, f.signal)).resolves.toBe(true);
    assertCall(f, input);
    unchanged();
  });

  it('accepts the maximum signed-bigint original version without rewriting it', async () => {
    const f = setup();
    const input = { ...event(), aggregateVersion: '9223372036854775807' };
    const unchanged = preserve(input);
    await expect(f.verifier.verify(input, f.signal)).resolves.toBe(true);
    assertCall(f, input);
    unchanged();
  });

  it.each([
    { label: 'false', value: false },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'zero', value: 0 },
    { label: 'one', value: 1 },
    { label: 'true string', value: 'true' },
    { label: 'false string', value: 'false' },
    { label: 'empty string', value: '' },
    { label: 'empty array', value: [] },
    { label: 'true array', value: [true] },
    { label: 'empty object', value: {} },
    { label: 'accepted wrapper', value: { accepted: true } },
    { label: 'data wrapper', value: { data: true } },
  ])('accepts no non-true response: $label', async ({ value }) => {
    const f = setup(value);
    // Explicit undefined must not select the fixture's default true reply.
    f.call.mockResolvedValue(value);
    const input = event();
    const unchanged = preserve(input);
    const replyUnchanged = preserve(value);
    await expect(f.verifier.verify(input, f.signal)).resolves.toBe(false);
    assertCall(f, input);
    unchanged();
    replyUnchanged();
  });

  it('propagates the exact RPC rejection sentinel without normalization or retry', async () => {
    const f = setup();
    const sentinel = new Error('controlled origin transport rejection');
    f.call.mockRejectedValue(sentinel);
    const input = event();
    const unchanged = preserve(input);
    let caught: unknown;
    try {
      await f.verifier.verify(input, f.signal);
    } catch (error) {
      caught = error;
    }
    expect(caught === sentinel).toBe(true);
    assertCall(f, input);
    unchanged();
  });

  it('refuses an already-aborted signal before RPC without changing the input', async () => {
    const f = setup();
    const controller = new AbortController();
    controller.abort();
    const input = event();
    const unchanged = preserve(input);
    await expect(f.verifier.verify(input, controller.signal)).resolves.toBe(
      false,
    );
    expect(f.call.mock.calls).toStrictEqual([]);
    unchanged();
  });

  it.each([
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'false', value: false },
    { label: 'number', value: 1 },
    { label: 'string', value: 'event' },
    { label: 'empty array', value: [] },
    { label: 'event array', value: [event()] },
    { label: 'empty object', value: {} },
    { label: 'request wrapper', value: { requestedEvent: event() } },
  ])(
    'refuses malformed envelope container $label without throwing or RPC',
    async ({ value }) => reject(value),
  );

  it.each(malformedFields)(
    'refuses $label at $key without throwing or RPC',
    async ({ key, value }) => {
      await reject({ ...event(), [key]: value });
    },
  );

  it.each(Object.keys(event()))(
    'refuses missing event member %s without RPC',
    async (key) => {
      const input: Record<string, unknown> = { ...event() };
      delete input[key];
      await reject(input);
    },
  );

  it.each(['extra', 'hidden', 'symbol', 'inherited replacement'])(
    'refuses event own-shape %s without changing caller metadata',
    async (kind) => {
      const input: Record<string, unknown> = { ...event() };
      if (kind === 'extra') input.ninth = true;
      if (kind === 'hidden')
        Object.defineProperty(input, 'hidden', { value: true });
      if (kind === 'symbol')
        Object.defineProperty(input, Symbol('extra'), { value: true });
      if (kind === 'inherited replacement') {
        const eventId = input.eventId;
        delete input.eventId;
        Object.setPrototypeOf(input, { eventId });
        Object.defineProperty(input, Symbol('replacement'), { value: true });
        expect(Reflect.ownKeys(input)).toHaveLength(8);
        expect(Object.hasOwn(input, 'eventId')).toBe(false);
      }
      await reject(input);
    },
  );

  it.each(['mutable', 'sealed', 'frozen'] as const)(
    'refuses a %s event array with event-like properties without freezing it',
    async (kind) => {
      const input = Object.assign([], event());
      if (kind === 'sealed') Object.seal(input);
      if (kind === 'frozen') Object.freeze(input);
      await reject(input);
    },
  );

  it.each(['mutable', 'sealed', 'frozen'] as const)(
    'refuses a %s malformed event object without changing its metadata',
    async (kind) => {
      const input = { ...event(), aggregateVersion: '1.2' };
      Object.setPrototypeOf(input, { inheritedMarker: 'unchanged' });
      if (kind === 'sealed') Object.seal(input);
      if (kind === 'frozen') Object.freeze(input);
      await reject(input);
    },
  );

  it.each([
    { label: 'null root', value: null },
    { label: 'empty array root', value: [] },
    {
      label: 'event-bearing array root',
      value: Object.assign([], { requestedEvent: event() }),
    },
    { label: 'missing event', value: {} },
    { label: 'array event', value: { requestedEvent: [] } },
    {
      label: 'decimal event',
      value: { requestedEvent: { ...event(), aggregateVersion: '1.2' } },
    },
    {
      label: 'extra root key',
      value: { requestedEvent: event(), extra: true },
    },
  ])(
    'rejects malformed one-key contract $label without caller mutation',
    ({ value }) => {
      const unchanged = preserve(value);
      expect(CmsSchemaDryRunOriginRequestSchema.safeParse(value).success).toBe(
        false,
      );
      unchanged();
    },
  );

  it('rejects an inherited root key with a same-count symbol replacement', () => {
    const input = {};
    Object.setPrototypeOf(input, { requestedEvent: event() });
    Object.defineProperty(input, Symbol('replacement'), { value: true });
    expect(Reflect.ownKeys(input)).toHaveLength(1);
    expect(Object.hasOwn(input, 'requestedEvent')).toBe(false);
    const unchanged = preserve(input);
    expect(CmsSchemaDryRunOriginRequestSchema.safeParse(input).success).toBe(
      false,
    );
    unchanged();
  });

  it('parses an immutable root and event while preserving the mutable caller', () => {
    const input = { requestedEvent: event(CAUSE) };
    const unchanged = preserve(input);
    const parsed = CmsSchemaDryRunOriginRequestSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error('Controlled origin request rejected');
    expect(parsed.data).toStrictEqual(input);
    expect(Object.isFrozen(parsed.data)).toBe(true);
    expect(Object.isFrozen(parsed.data.requestedEvent)).toBe(true);
    expect(parsed.data === input).toBe(false);
    expect(parsed.data.requestedEvent === input.requestedEvent).toBe(false);
    unchanged();
  });
});

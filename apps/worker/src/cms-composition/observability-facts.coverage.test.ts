import { describe, expect, it, vi } from 'vitest';

import { factsOf, noteStage } from './observability-facts';
import { instrumentComposition } from './observability-instrument';
import {
  compositionRequestLog,
  type CompositionTelemetryEvent,
} from './observability-observation';

/*
 * [P2-S12-AC-264] BE03c Observability: a trace lists a stage once, in the order the request entered it, and only the
 * stages a request really reached. A seam that is not registered, or an input that does not carry a `Request`, leaves
 * no fact and never changes what the route receives.
 */

const signal = new AbortController().signal;

describe('request stage facts', () => {
  it('lists a stage once, at its first entry, however often the request re-enters it', () => {
    const request = new Request('https://api.example.test/x');
    for (const stage of ['validation', 'rpc', 'validation', 'rpc', 'audit'])
      noteStage(request, stage);
    expect(factsOf(request).stages).toEqual(['validation', 'rpc', 'audit']);
  });
});

describe('instrumentComposition leaves what is not a seam alone', () => {
  it('wraps no session resolver when the family has none, and skips a named port it does not have', () => {
    const present = vi.fn(async () => 'ok');
    const dependencies = {
      present,
      humanOrigins: ['https://cms.example.test'],
    };
    const wrapped = instrumentComposition(dependencies as never, {
      writes: ['absentWrite', 'present'] as never,
      reads: ['absentRead'] as never,
    }) as unknown as Record<string, unknown>;
    expect(wrapped).not.toHaveProperty('resolveSession');
    expect(wrapped).not.toHaveProperty('absentWrite');
    expect(wrapped).not.toHaveProperty('absentRead');
    expect(wrapped.humanOrigins).toBe(dependencies.humanOrigins);
  });

  it.each([
    ['null', null],
    ['a string', 'input'],
    ['an object without a request', {}],
    ['an object whose request is not a Request', { request: 'GET /x' }],
  ])(
    'passes %s through a wrapped port unchanged and notes no stage',
    async (_label, input) => {
      const port = vi.fn(async (value: unknown) => value);
      const wrapped = instrumentComposition(
        { port } as { port: (input: unknown, signal: AbortSignal) => unknown },
        { writes: ['port'] },
      );
      expect(await wrapped.port(input, signal)).toBe(input);
      expect(port).toHaveBeenCalledWith(input, signal);
    },
  );
});

describe('compositionRequestLog actor class', () => {
  const event = (
    overrides: Partial<CompositionTelemetryEvent>,
  ): CompositionTelemetryEvent => ({
    requestId: '11111111-1111-4111-8111-111111111111',
    status: 200,
    outcome: 'success',
    durationMs: 3,
    ...overrides,
  });
  const names = { eventName: 'cms.composition.test', operation: 'test' };

  it.each([
    ['an explicit human actor', event({ actorClass: 'human' })],
    ['an omitted actor (defaults to human)', event({})],
  ])('logs actor_class human for %s', (_label, input) => {
    expect(compositionRequestLog(input, names).attributes).toEqual({
      actor_class: 'human',
      status: 200,
      runbook: 'cms-composition',
    });
  });
});

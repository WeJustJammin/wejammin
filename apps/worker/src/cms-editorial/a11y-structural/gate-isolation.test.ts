import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  blockNode,
  checkerInput,
  fieldNode,
  heading,
  httpsLink,
  paragraph,
  richText,
  span,
} from './a11y-structural.test-support';
import {
  evaluateAccessibilityGate,
  type AccessibilityLoadResult,
} from './gate';

/**
 * P2-S11-AC-098, run-time half: the gate runs with every network, DOM and
 * browser global replaced by a trap that throws, and finishes with a typed
 * result and no trap touched. (`purity.test.ts` is the static half.)
 */

const NETWORK_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
] as const;
// `navigator` is left alone on purpose: the zod runtime reads it once for a harmless feature check.
const DOM_GLOBALS = ['document', 'window', 'Browser'] as const;

const touched: string[] = [];
const saved = new Map<string, PropertyDescriptor | undefined>();

const trapAll = (): void => {
  for (const name of [...NETWORK_GLOBALS, ...DOM_GLOBALS]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: () => {
        touched.push(name);
        throw new Error(`${name} must not be used by cms.a11y.structural`);
      },
    });
  }
};

const restoreAll = (): void => {
  for (const [name, descriptor] of saved) {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, name);
    else Object.defineProperty(globalThis, name, descriptor);
  }
  saved.clear();
};

beforeEach(() => {
  touched.length = 0;
  trapAll();
});
afterEach(restoreAll);

const loaded = (input: unknown): (() => Promise<AccessibilityLoadResult>) =>
  vi.fn(async () => ({ ok: true as const, input }));

const CLEAN = checkerInput([
  fieldNode(1, richText(heading(2, span('Note'))), 'note'),
  fieldNode(
    2,
    richText(
      heading(2, span('Plan')),
      paragraph(span('Read the guide', httpsLink())),
    ),
  ),
  blockNode(1, { nameRequired: true, accessibleName: 'Main navigation' }),
]);

const BLOCKED = checkerInput([
  fieldNode(1, richText(heading(3, span('Lead'))), 'lead'),
]);

describe('the accessibility gate with every network, DOM and browser global trapped', () => {
  it('traps are armed: reaching for fetch or document throws and is recorded', () => {
    expect(() => (globalThis as { fetch?: unknown }).fetch).toThrow(/fetch/u);
    expect(() => (globalThis as { document?: unknown }).document).toThrow(
      /document/u,
    );
    expect(touched).toEqual(['fetch', 'document']);
    touched.length = 0;
  });

  it('completes a healthy run', async () => {
    const run = await evaluateAccessibilityGate({ load: loaded(CLEAN) });
    expect(run.state).toBe('healthy');
    expect(touched).toEqual([]);
  });

  it('completes a blocked run', async () => {
    const run = await evaluateAccessibilityGate({ load: loaded(BLOCKED) });
    expect(run.state).toBe('blocked');
    expect(touched).toEqual([]);
  });

  it('answers a failed load, an unreadable target and a throwing load with a typed failure', async () => {
    const results = await Promise.all([
      evaluateAccessibilityGate({
        load: async () => ({
          ok: false,
          retryable: false,
          reason: 'dependency_unavailable',
        }),
      }),
      evaluateAccessibilityGate({
        load: async () => ({
          ok: false,
          retryable: false,
          reason: 'target_unreadable',
        }),
      }),
      evaluateAccessibilityGate({
        load: () => {
          throw new Error('load failed');
        },
      }),
      evaluateAccessibilityGate({ load: loaded({ not: 'an input' }) }),
    ]);
    expect(results.map((run) => run.state)).toEqual([
      'failed',
      'failed',
      'failed',
      'failed',
    ]);
    expect(touched).toEqual([]);
  });

  it('ends a load that never settles at its deadline without any network', async () => {
    const run = await evaluateAccessibilityGate({
      load: () => new Promise<AccessibilityLoadResult>(() => undefined),
      timeoutMs: 100,
    });
    expect(run).toMatchObject({
      state: 'failed',
      failureCode: 'CHECKER_TIMEOUT',
    });
    expect(touched).toEqual([]);
  });

  it('only ever calls the load it was given', async () => {
    const load = loaded(CLEAN);
    await evaluateAccessibilityGate({ load });
    expect(load).toHaveBeenCalledTimes(1);
    expect(touched).toEqual([]);
  });
});

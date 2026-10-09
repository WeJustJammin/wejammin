import { describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { stepUpDraftScope } from '../content-schema-registry/content-schema-registry-step-up-scope';
import {
  createWorkflowCommandController,
  type WorkflowCommandController,
  type WorkflowControllerOptions,
} from './cms-workflow-command-controller';
import type { WorkflowCommandResult } from './cms-workflow-command-transport';

type Body = { readonly reason: string };
type Resource = { readonly id: string };

const PATH = '/app/cms-content-modeling/reviews/abc';
const SEARCH = '?scope=assigned';
const OPERATION = 'CMS-03B-06' as const;
const SCOPE = stepUpDraftScope(PATH, OPERATION);
const COMMITTED: WorkflowCommandResult<Resource> = {
  kind: 'committed',
  resource: { id: 'review' },
  status: 200,
};
const refusalResult = (
  status: number,
  extra: Record<string, unknown> = {},
): WorkflowCommandResult<Resource> => ({
  kind: 'refused',
  refusal: {
    status,
    code: null,
    reason: null,
    details: null,
    conflict: null,
    violations: [],
    retryAfterSeconds: null,
    preflightUnavailable: false,
    requestId: null,
    ...extra,
  },
});

interface Harness {
  readonly controller: WorkflowCommandController<Body, Resource>;
  readonly send: ReturnType<typeof vi.fn>;
  readonly refetch: ReturnType<typeof vi.fn>;
  readonly onCommitted: ReturnType<typeof vi.fn>;
  readonly navigate: ReturnType<typeof vi.fn>;
  readonly storage: MemoryStorage;
}

let keyCounter = 0;
const harness = (
  results: readonly (
    WorkflowCommandResult<Resource> | Promise<WorkflowCommandResult<Resource>>
  )[],
  overrides: Partial<
    WorkflowControllerOptions<Record<string, never>, Body, Resource>
  > = {},
  storage = new MemoryStorage(),
  refetchResults: readonly boolean[] = [true],
): Harness => {
  const queue = [...results];
  const refetchQueue = [...refetchResults];
  const send = vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected send');
    return next;
  });
  const refetch = vi.fn(async () => refetchQueue.shift() ?? true);
  const onCommitted = vi.fn();
  const navigate = vi.fn();
  const controller = createWorkflowCommandController<
    Record<string, never>,
    Body,
    Resource
  >({
    operationId: OPERATION,
    ids: {},
    send,
    refetch,
    onCommitted,
    navigate,
    location: () => ({ pathname: PATH, search: SEARCH }),
    storage: () => storage,
    newKey: () => `key-${String((keyCounter += 1)).padStart(10, '0')}`,
    ...overrides,
  });
  return { controller, send, refetch, onCommitted, navigate, storage };
};

const request = (reason = 'Looks right.') => ({
  body: { reason },
  ifMatch: '"4"',
  draft: { reason, decision: 'approve' },
});

const flush = async (): Promise<void> => {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
};

describe('initial state', () => {
  it('starts idle with a printable key and nothing to show', () => {
    const { controller } = harness([]);
    const state = controller.getState();
    expect(state).toMatchObject({
      phase: 'idle',
      committed: null,
      refusal: null,
      restoredValues: null,
      conflict: null,
      reconciled: false,
    });
    expect(state.idempotencyKey).toMatch(/^key-\d{10}$/u);
  });

  it('notifies a subscriber on every change and stops after unsubscribe', async () => {
    const { controller } = harness([COMMITTED]);
    const listener = vi.fn();
    const stop = controller.subscribe(listener);
    await controller.submit(request());
    expect(listener).toHaveBeenCalled();
    const calls = listener.mock.calls.length;
    stop();
    controller.dismiss();
    expect(listener).toHaveBeenCalledTimes(calls);
  });
});

describe('commit', () => {
  it('sends the request once with the key and hands the resource to the island', async () => {
    const { controller, send, onCommitted, storage } = harness([COMMITTED]);
    const key = controller.getState().idempotencyKey;
    await controller.submit(request());
    expect(send).toHaveBeenCalledWith({
      ids: {},
      body: { reason: 'Looks right.' },
      ifMatch: '"4"',
      idempotencyKey: key,
    });
    expect(controller.getState()).toMatchObject({
      phase: 'committed',
      committed: { id: 'review' },
    });
    expect(onCommitted).toHaveBeenCalledWith({ id: 'review' });
    expect(storage.getItem(`wj-step-up-draft:${SCOPE}`)).toBeNull();
  });

  it('commits exactly once even when the command is submitted twice at once', async () => {
    const { controller, send } = harness([COMMITTED, COMMITTED]);
    await Promise.all([
      controller.submit(request()),
      controller.submit(request()),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    await controller.submit(request());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('shows the pending phase while the command is in flight', async () => {
    let release: (value: WorkflowCommandResult<Resource>) => void = () =>
      undefined;
    const held = new Promise<WorkflowCommandResult<Resource>>((resolve) => {
      release = resolve;
    });
    const { controller } = harness([held]);
    const done = controller.submit(request());
    expect(controller.getState().phase).toBe('pending');
    release(COMMITTED);
    await done;
    expect(controller.getState().phase).toBe('committed');
  });
});

describe('starting over', () => {
  it('forgets a commit and begins a new command under a fresh key', async () => {
    const { controller, send } = harness([COMMITTED, COMMITTED]);
    controller.startOver();
    expect(controller.getState().phase).toBe('idle');
    await controller.submit(request());
    const first = controller.getState().idempotencyKey;
    controller.startOver();
    expect(controller.getState()).toMatchObject({
      phase: 'idle',
      committed: null,
      refusal: null,
    });
    expect(controller.getState().idempotencyKey).not.toBe(first);
    await controller.submit(request('Again.'));
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('definite refusals', () => {
  it('rotates the key, refetches the canonical state and keeps the input on a stale conflict', async () => {
    const { controller, refetch } = harness([
      refusalResult(409, { reason: 'dependency_changed' }),
      COMMITTED,
    ]);
    const first = controller.getState().idempotencyKey;
    await controller.submit(request());
    const state = controller.getState();
    expect(state.phase).toBe('refused');
    expect(state.refusal).toMatchObject({ kind: 'refetch', refetch: true });
    expect(state.idempotencyKey).not.toBe(first);
    expect(refetch).toHaveBeenCalledTimes(1);
    await controller.submit(request('Edited.'));
    expect(controller.getState().phase).toBe('committed');
  });

  it('keeps the key on a rate limit and does not refetch', async () => {
    const { controller, refetch } = harness([
      refusalResult(429, { retryAfterSeconds: 5 }),
    ]);
    const key = controller.getState().idempotencyKey;
    await controller.submit(request());
    expect(controller.getState().idempotencyKey).toBe(key);
    expect(controller.getState().refusal?.kind).toBe('rate-limited');
    expect(refetch).not.toHaveBeenCalled();
  });

  it('shows the capability gate for a 403 and dismisses it back to idle', async () => {
    const { controller } = harness([
      refusalResult(403, { reason: 'separation_of_duties' }),
    ]);
    await controller.submit(request());
    expect(controller.getState().refusal?.kind).toBe('gate');
    controller.dismiss();
    expect(controller.getState()).toMatchObject({
      phase: 'idle',
      refusal: null,
    });
  });

  it('reports a request it never sent as an invalid request without changing the key', async () => {
    const { controller } = harness([
      { kind: 'local', reason: 'csrf_missing' },
      { kind: 'local', reason: 'request_invalid' },
    ]);
    const key = controller.getState().idempotencyKey;
    await controller.submit(request());
    expect(controller.getState().refusal).toMatchObject({
      kind: 'invalid',
      message: 'Your session is missing its security token. Reload the page.',
    });
    await controller.submit(request());
    expect(controller.getState().refusal?.message).toBe(
      'This request could not be sent. Reload the page and try again.',
    );
    expect(controller.getState().idempotencyKey).toBe(key);
  });
});

describe('unknown outcomes', () => {
  it('reconciles with a canonical read and then replays the identical request under the same key', async () => {
    const { controller, send, refetch } = harness([
      { kind: 'unknown', requestId: null },
      COMMITTED,
    ]);
    const key = controller.getState().idempotencyKey;
    await controller.submit(request());
    await flush();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      phase: 'unknown',
      reconciled: true,
      idempotencyKey: key,
    });
    await controller.retry();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toEqual(send.mock.calls[0]?.[0]);
    expect(controller.getState().phase).toBe('committed');
  });

  it('does not accept a new submit or a retry before the reconciling read succeeded', async () => {
    const { controller, send, refetch } = harness(
      [{ kind: 'unknown', requestId: null }, COMMITTED],
      {},
      new MemoryStorage(),
      [false, true],
    );
    await controller.submit(request());
    await flush();
    expect(controller.getState()).toMatchObject({
      phase: 'unknown',
      reconciled: false,
    });
    await controller.submit(request('Another.'));
    await controller.retry();
    expect(send).toHaveBeenCalledTimes(1);
    await controller.reconcile();
    expect(refetch).toHaveBeenCalledTimes(2);
    expect(controller.getState().reconciled).toBe(true);
    await controller.retry();
    expect(controller.getState().phase).toBe('committed');
  });

  it('ignores a retry or reconcile when nothing is unknown', async () => {
    const { controller, send, refetch } = harness([]);
    await controller.retry();
    await controller.reconcile();
    expect(send).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('settles a second unknown outcome the same way and a definite refusal after it rotates the key', async () => {
    const { controller } = harness([
      { kind: 'unknown', requestId: null },
      { kind: 'unknown', requestId: null },
      refusalResult(409, { reason: 'review_not_open' }),
    ]);
    const key = controller.getState().idempotencyKey;
    await controller.submit(request());
    await flush();
    await controller.retry();
    await flush();
    expect(controller.getState()).toMatchObject({
      phase: 'unknown',
      idempotencyKey: key,
    });
    await controller.retry();
    expect(controller.getState().phase).toBe('refused');
    expect(controller.getState().idempotencyKey).not.toBe(key);
  });
});

describe('step-up recovery', () => {
  it('stores the scoped draft with the key and the version, then navigates without replaying', async () => {
    const { controller, send, navigate, storage } = harness([
      { kind: 'step-up', recovery: { kind: 'navigate' } },
    ]);
    const key = controller.getState().idempotencyKey;
    await controller.submit(request());
    expect(send).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      `/step-up?returnTo=${encodeURIComponent(`${PATH}${SEARCH}`)}`,
    );
    expect(controller.getState().phase).toBe('step-up-leaving');
    const stored = JSON.parse(
      storage.getItem(`wj-step-up-draft:${SCOPE}`) as string,
    ) as {
      values: Record<string, string>;
      idempotencyKey: string;
      expectedVersion: string;
    };
    expect(stored.values).toEqual({
      reason: 'Looks right.',
      decision: 'approve',
    });
    expect(stored.idempotencyKey).toBe(key);
    expect(stored.expectedVersion).toBe('4');
    await controller.submit(request());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('still leaves for step-up when the tab cannot store a draft', async () => {
    const { controller, navigate } = harness(
      [{ kind: 'step-up', recovery: { kind: 'navigate' } }],
      {},
    );
    const blocked = harness(
      [{ kind: 'step-up', recovery: { kind: 'navigate' } }],
      { storage: () => null },
    );
    await blocked.controller.submit(request());
    expect(blocked.navigate).toHaveBeenCalledTimes(1);
    await controller.submit(request());
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('shows a degraded state with the request id when no usable method exists or the details are malformed', async () => {
    for (const kind of ['no-method', 'malformed'] as const) {
      const { controller, navigate, storage } = harness([
        { kind: 'step-up', recovery: { kind, requestId: 'req-1' } },
      ]);
      await controller.submit(request());
      expect(controller.getState()).toMatchObject({
        phase: 'step-up-unavailable',
        stepUpIssue: { kind, requestId: 'req-1' },
      });
      expect(navigate).not.toHaveBeenCalled();
      expect(storage.length).toBe(0);
    }
  });

  it('answers a missing or expired session with a sign-in link to this exact page', async () => {
    const { controller, navigate } = harness([
      { kind: 'signed-out', requestId: 'req-2' },
    ]);
    await controller.submit(request());
    expect(controller.getState()).toMatchObject({
      phase: 'signed-out',
      signInHref: `/auth/sign-in?returnTo=${encodeURIComponent(`${PATH}${SEARCH}`)}`,
      requestId: 'req-2',
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('restore after step-up', () => {
  const interrupted = async () => {
    const storage = new MemoryStorage();
    const first = harness(
      [{ kind: 'step-up', recovery: { kind: 'navigate' } }],
      {},
      storage,
    );
    await first.controller.submit(request());
    return { storage, key: first.controller.getState().idempotencyKey };
  };

  it('restores the values, pins the original key and waits for explicit re-confirmation', async () => {
    const { storage, key } = await interrupted();
    const { controller, send } = harness([COMMITTED], {}, storage);
    const restored = controller.restore('4');
    expect(restored).toEqual({ reason: 'Looks right.', decision: 'approve' });
    expect(controller.getState()).toMatchObject({
      phase: 'restored',
      idempotencyKey: key,
      restoredValues: { reason: 'Looks right.', decision: 'approve' },
      conflict: null,
    });
    expect(send).not.toHaveBeenCalled();
    await controller.submit(request());
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].idempotencyKey).toBe(key);
    expect(controller.getState().phase).toBe('committed');
    expect(controller.restore('4')).toBeNull();
  });

  it('opens a sync conflict when the expected version changed, and rotates the key on acknowledgement', async () => {
    const { storage, key } = await interrupted();
    const { controller, send } = harness([COMMITTED], {}, storage);
    controller.restore('9');
    expect(controller.getState()).toMatchObject({
      phase: 'conflict',
      conflict: { draftVersion: '4', currentVersion: '9' },
      restoredValues: { reason: 'Looks right.', decision: 'approve' },
    });
    await controller.submit(request());
    expect(send).not.toHaveBeenCalled();
    controller.acknowledgeConflict();
    expect(controller.getState().phase).toBe('restored');
    expect(controller.getState().idempotencyKey).not.toBe(key);
    expect(controller.getState().conflict).toBeNull();
    await controller.submit(request());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('treats an unknown current version as a conflict and a missing draft as nothing to restore', async () => {
    const { storage } = await interrupted();
    const conflicted = harness([], {}, storage);
    conflicted.controller.restore(null);
    expect(conflicted.controller.getState().conflict).toEqual({
      draftVersion: '4',
      currentVersion: null,
    });
    const none = harness([]);
    expect(none.controller.restore('4')).toBeNull();
    expect(none.controller.getState().phase).toBe('idle');
    none.controller.acknowledgeConflict();
    expect(none.controller.getState().phase).toBe('idle');
  });
});

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  expectStaged,
  fixture,
  localAdapter,
  noClient,
  promoted,
  type Fixture,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';

type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };
const outcome = <T>(pending: Promise<T>): Promise<Outcome<T>> =>
  pending.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

type Command = Parameters<Fixture['process']['run']>[0];
const isReset = (command: Command) => command.args.includes('reset');
const resetAttempts = (mock: Fixture) =>
  mock.process.run.mock.calls.filter(([command]) => isReset(command)).length;

// Hold only the first selected raw port entry, before its implementation runs.
// vi.fn has already recorded entry, including calls which will later reject.
function hold(mock: Fixture, selected: (command: Command) => boolean) {
  const entered = gate();
  const released = gate();
  const original = mock.process.run.getMockImplementation();
  if (!original) throw new Error('raw process implementation required');
  let held = false;
  mock.process.run.mockImplementation(async (command) => {
    if (!held && selected(command)) {
      held = true;
      entered.release();
      await released.promise;
    }
    return original(command);
  });
  return { entered: entered.promise, release: released.release };
}

async function atBoundary<T>(
  first: Promise<Outcome<T>>,
  held: ReturnType<typeof hold>,
) {
  await Promise.race([
    held.entered,
    first.then(() => {
      throw new Error(
        'first operation settled before the selected raw boundary',
      );
    }),
  ]);
}

function success<T>(result: Outcome<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  return result.value;
}

async function refusedWithoutMutation(
  mock: Fixture,
  start: () => Promise<unknown>,
) {
  const attempts = resetAttempts(mock);
  const writes = [...mock.fs.writes];
  const result = await outcome(start());
  expect(
    result.ok,
    'overlap must refuse, not enter another reset lifetime',
  ).toBe(false);
  if (!result.ok) expect(result.error).toBeInstanceOf(Error);
  expect(resetAttempts(mock), 'all raw reset entries, even rejected ones').toBe(
    attempts,
  );
  expect(
    mock.fs.writes,
    'overlap cannot stage, replace links or clean up',
  ).toEqual(writes);
  noClient(mock);
}

async function prepared(mock: Fixture) {
  const adapter = await localAdapter('prefix', mock);
  const attestation = await adapter.preparePrefix(mock.plan);
  return { adapter, attestation };
}

const link = (mock: Fixture) =>
  join(mock.plan.target.workdir, 'supabase/migrations');

describe('DEC-197 local prefix exclusive operation lifetime', () => {
  it('DR-UL-L01 reset admission is exclusive before the first awaited proof returns', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    const held = hold(mock, (command) => command.args[0] === 'inspect');
    const first = outcome(adapter.resetBefore(mock.plan, attestation));
    let drained: Awaited<typeof first>;
    try {
      await atBoundary(first, held);
      expect(resetAttempts(mock)).toBe(0);
      await refusedWithoutMutation(mock, () =>
        adapter.resetBefore(mock.plan, attestation),
      );
    } finally {
      held.release();
      drained = await first;
    }
    success(drained);
    expect(resetAttempts(mock)).toBe(1);
    expectStaged(mock, 0, mock.plan.prefixManifest.entries);
    await adapter.restoreBaseline(mock.plan, attestation);
    expectStaged(mock, 1, mock.entries);
    expect(await mock.fs.readlink(link(mock))).toBe(promoted);
  });

  it('DR-UL-L02 simultaneous preflights cannot replace one another after an await', async () => {
    const mock = await fixture();
    const adapter = await localAdapter('prefix', mock);
    const held = hold(mock, (command) => command.args[0] === 'inspect');
    const first = outcome(adapter.preparePrefix(mock.plan));
    let drained: Awaited<typeof first>;
    try {
      await atBoundary(first, held);
      await refusedWithoutMutation(mock, () =>
        adapter.preparePrefix(mock.plan),
      );
    } finally {
      held.release();
      drained = await first;
    }
    const attestation = success(drained);
    expect(resetAttempts(mock)).toBe(0);
    expect(mock.fs.writes).toEqual([]);
    await adapter.resetBefore(mock.plan, attestation);
    await adapter.restoreBaseline(mock.plan, attestation);
    expect(resetAttempts(mock)).toBe(2);
    expectStaged(mock, 0, mock.plan.prefixManifest.entries);
    expectStaged(mock, 1, mock.entries);
  });

  for (const second of ['reset', 'restore'] as const) {
    it(`DR-UL-L03 held reset excludes overlapping ${second} until its owned lifetime drains`, async () => {
      const mock = await fixture();
      const { adapter, attestation } = await prepared(mock);
      const held = hold(mock, isReset);
      const first = outcome(adapter.resetBefore(mock.plan, attestation));
      let drained: Awaited<typeof first>;
      try {
        await atBoundary(first, held);
        expect(resetAttempts(mock)).toBe(1);
        expect(mock.resets).toHaveLength(0);
        await refusedWithoutMutation(mock, () =>
          second === 'reset'
            ? adapter.resetBefore(mock.plan, attestation)
            : adapter.restoreBaseline(mock.plan, attestation),
        );
      } finally {
        held.release();
        drained = await first;
      }
      const reset = success(drained);
      expect(resetAttempts(mock)).toBe(1);
      expectStaged(mock, 0, mock.plan.prefixManifest.entries);
      const restoration = await adapter.restoreBaseline(mock.plan, attestation);
      expect(restoration.resetEpoch).not.toBe(reset.resetEpoch);
      expect(resetAttempts(mock)).toBe(2);
      expectStaged(mock, 1, mock.entries);
      expect(await mock.fs.readlink(link(mock))).toBe(promoted);
    });
  }

  it('DR-UL-L04 a held restoration excludes a second restoration and keeps cleanup owned', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    const reset = await adapter.resetBefore(mock.plan, attestation);
    const held = hold(mock, isReset);
    const first = outcome(adapter.restoreBaseline(mock.plan, attestation));
    let drained: Awaited<typeof first>;
    try {
      await atBoundary(first, held);
      expect(resetAttempts(mock)).toBe(2);
      expect(mock.resets).toHaveLength(1);
      await refusedWithoutMutation(mock, () =>
        adapter.restoreBaseline(mock.plan, attestation),
      );
    } finally {
      held.release();
      drained = await first;
    }
    expect(success(drained).resetEpoch).not.toBe(reset.resetEpoch);
    expect(resetAttempts(mock)).toBe(2);
    expectStaged(mock, 0, mock.plan.prefixManifest.entries);
    expectStaged(mock, 1, mock.entries);
    expect(await mock.fs.readlink(link(mock))).toBe(promoted);
  });

  it('DR-UL-L05 failed reset releases exclusivity but retains required restoration authority', async () => {
    const mock = await fixture();
    const { adapter, attestation } = await prepared(mock);
    const failure = Object.assign(new Error('ambiguous held reset failure'), {
      code: 'ETIMEDOUT',
    });
    mock.state.resetError = failure;
    const held = hold(mock, isReset);
    const first = outcome(adapter.resetBefore(mock.plan, attestation));
    let drained: Awaited<typeof first>;
    try {
      await atBoundary(first, held);
      await refusedWithoutMutation(mock, () =>
        adapter.restoreBaseline(mock.plan, attestation),
      );
    } finally {
      held.release();
      drained = await first;
    }
    expect(drained.ok).toBe(false);
    if (!drained.ok) expect(drained.error).toBe(failure);
    expect(resetAttempts(mock)).toBe(1);
    mock.state.resetError = undefined;
    const restored = await adapter.restoreBaseline(mock.plan, attestation);
    expect(restored.baselineSha256).toBe(attestation.baselineSha256);
    expect(resetAttempts(mock)).toBe(2);
    expectStaged(mock, 0, mock.plan.prefixManifest.entries);
    expectStaged(mock, 1, mock.entries);
    expect(await mock.fs.readlink(link(mock))).toBe(promoted);
  });
});

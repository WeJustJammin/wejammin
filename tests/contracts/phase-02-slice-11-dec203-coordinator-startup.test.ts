import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCoordinatorStartupFixture,
  row,
  type CoordinatorStartupFixture,
} from './helpers/dec203-coordinator-startup-fixture';

// Pure mocked unit controls for the production coordinator-startup observer.
// The fixture carries literal topology only; node:fs readlink, the production
// process functions and artifacts.named are mocked. No /proc, native, kernel,
// DB or authority evidence. This is a preparatory RED for the pending-startup
// CLOEXEC design; the all-flags-valid baseline must pass under the current
// (pre-change) lease bit guard, so a fixture error cannot masquerade as RED.

const IDENTITY = 'DEC203_SUPERVISOR_IDENTITY_CHANGED';
const CLOEXEC = 0o2000000n;

const io = vi.hoisted(() => {
  const state = {
    plan: null as unknown,
    childrenOfC: [] as number[],
    childrenOfI: [] as number[],
    compilerCaptures: 0,
    startTimes: new Map<number, string>(),
  };
  return { state, readlink: vi.fn<(path: string) => string>() };
});

vi.mock('node:fs', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  readlinkSync: io.readlink,
}));

vi.mock(
  '../../infra/database-upgrades/native-tracing/receiving-bootstrap-artifacts.mjs',
  async (original) => ({
    ...(await original<Record<string, unknown>>()),
    named: (path: string) =>
      (io.state.plan as CoordinatorStartupFixture | null)?.named.get(path),
  }),
);

vi.mock(
  '../../infra/database-upgrades/native-tracing/receiving-bootstrap-processes.mjs',
  () => ({
    captureProcess: (pid: number) => {
      const plan = io.state.plan as CoordinatorStartupFixture;
      if (pid === 501) return plan.captures.owner;
      if (pid === 502) return plan.captures.coordinator;
      if (pid === 503) {
        io.state.compilerCaptures += 1;
        return plan.captures.compiler;
      }
      throw new Error('unplanned captureProcess');
    },
    children: (pid: number) => {
      if (pid === 501) return [...io.state.childrenOfC];
      if (pid === 502) return [...io.state.childrenOfI];
      throw new Error('unplanned children');
    },
    fdSnapshot: (value: { process: { pid: number } }) => {
      const plan = io.state.plan as CoordinatorStartupFixture;
      if (value.process.pid === 501) return plan.inventories.owner;
      if (value.process.pid === 502) return plan.inventories.coordinator;
      if (value.process.pid === 503) return plan.inventories.compiler;
      throw new Error('unplanned fdSnapshot');
    },
    facts: (pid: number) => {
      const startTime = io.state.startTimes.get(pid);
      if (startTime === undefined) throw new Error('unplanned facts');
      return { pid, startTime };
    },
  }),
);

type Observer = {
  sample(): boolean;
  postAdoption(): boolean;
  phase(name: string): unknown;
  process(name: string): unknown;
};
type Api = {
  createOwnerObserver(
    child: { pid: number },
    info: { root: string; inputs: readonly unknown[] },
    output: unknown,
    id: string,
  ): Observer;
};
type Inventory = CoordinatorStartupFixture['inventories']['coordinator'];

let api: Api;
let plan: CoordinatorStartupFixture;

beforeAll(async () => {
  const namespace: unknown = await import(
    new URL(
      '../../infra/database-upgrades/native-tracing/receiving-bootstrap-observe.mjs',
      import.meta.url,
    ).href
  );
  const create = (namespace as Record<string, unknown>).createOwnerObserver;
  expect(create, 'actual production createOwnerObserver').toBeTypeOf(
    'function',
  );
  api = namespace as Api;
});

beforeEach(() => {
  vi.clearAllMocks();
  plan = createCoordinatorStartupFixture(process.pid);
  const { owner, coordinator, compiler } = plan.captures;
  io.state.plan = plan;
  io.state.childrenOfC = [coordinator.process.pid];
  io.state.childrenOfI = [];
  io.state.compilerCaptures = 0;
  io.state.startTimes = new Map([
    [owner.process.pid, owner.process.startTime],
    [coordinator.process.pid, coordinator.process.startTime],
    [compiler.process.pid, compiler.process.startTime],
  ]);
  io.readlink.mockImplementation((path: string) => {
    if (path === '/proc/self/ns/pid') return plan.namespace;
    throw new Error('unplanned readlink path');
  });
});

const driver = (): Observer =>
  api.createOwnerObserver(plan.child, plan.info, plan.output, plan.id);

type Outcome = { value?: boolean; error?: unknown };

const attempt = (action: () => boolean): Outcome => {
  try {
    return { value: action() };
  } catch (error) {
    return { error };
  }
};

const coded = (error: unknown, code: string): void => {
  expect(error, 'coded supervisor failure').toBeInstanceOf(Error);
  expect(error).toMatchObject({ code, message: code });
};

const hardRefusal = (outcome: Outcome): void => {
  coded(outcome.error, IDENTITY);
  expect(
    (outcome.error as { incompleteSnapshot?: unknown }).incompleteSnapshot,
  ).toBeUndefined();
};

const clearCloexec = (inventory: Inventory, fd: number): void => {
  const target = row(inventory, fd);
  const masked = BigInt(`0o${target.flags}`) & ~CLOEXEC;
  target.flags = masked === 0n ? '0' : `0${masked.toString(8)}`;
};

const restoreCloexec = (inventory: Inventory, fd: number): void => {
  const target = row(inventory, fd);
  const value = BigInt(`0o${target.flags}`) | CLOEXEC;
  target.flags = `0${value.toString(8)}`;
};

const expectPending = (observer: Observer): void => {
  const outcome = attempt(() => observer.sample());
  expect(outcome.error, 'pending startup must not throw').toBeUndefined();
  expect(outcome.value).toBe(false);
  expect(observer.phase('coordinator-precompile')).toBeUndefined();
  expect(observer.phase('lease-compiler-live')).toBeUndefined();
  expect(observer.phase('coordinator-adopted')).toBeUndefined();
};

const corruptions: readonly (readonly [string, () => void])[] = [
  [
    'a missing protected FD',
    () => {
      plan.inventories.coordinator.fds =
        plan.inventories.coordinator.fds.filter((entry) => entry.fd !== 5);
    },
  ],
  [
    'a wrong valid lock mode',
    () => {
      row(plan.inventories.owner, 5).mode = 0o100600;
    },
  ],
  [
    'a wrong valid lock uid',
    () => {
      row(plan.inventories.owner, 3).uid = 1001;
    },
  ],
  [
    'a crossed protected identity',
    () => {
      row(plan.inventories.coordinator, 5).inode = '999';
    },
  ],
  [
    'a crossed pidfd owner',
    () => {
      const pidfd = row(plan.inventories.coordinator, 7).pidfd;
      if (pidfd === null) throw new Error('fixture pidfd row missing');
      pidfd.pid = 502;
    },
  ],
  [
    'a crossed channel access',
    () => {
      row(plan.inventories.coordinator, 8).flags = '02000001';
    },
  ],
  [
    'an aliased outer object',
    () => {
      row(plan.inventories.owner, 9).inode = '808';
    },
  ],
  [
    'a replaced named lock stat',
    () => {
      for (const [path, stat] of plan.named) {
        plan.named.set(path, { ...stat, ino: 999n });
        break;
      }
    },
  ],
];

describe('DEC203 coordinator startup classification, mocked, not native proof', () => {
  it('CS01 all flags valid qualifies with a coordinator-precompile inventory', () => {
    const observer = driver();
    const outcome = attempt(() => observer.sample());
    expect(outcome.error).toBeUndefined();
    expect(outcome.value).toBe(true);
    expect(observer.phase('coordinator-precompile')).toBe(
      plan.inventories.coordinator,
    );
    expect(observer.process('owner')).toBe(plan.captures.owner);
    expect(observer.process('coordinator')).toBe(plan.captures.coordinator);
  });

  it('CS02 a childless owner snapshot primes owner-leased', () => {
    io.state.childrenOfC = [];
    const observer = driver();
    expect(attempt(() => observer.sample()).value).toBe(true);
    expect(observer.phase('owner-leased')).toBe(plan.inventories.owner);
  });

  for (const fd of [3, 4, 5, 6, 7, 8, 9, 10])
    it(`CS03 missing CLOEXEC on inherited FD${fd} stays pending`, () => {
      clearCloexec(plan.inventories.coordinator, fd);
      const observer = driver();
      expect(io.state.compilerCaptures).toBe(0);
      expectPending(observer);
    });

  it('CS04 repeated pending stays false until every bit is restored', () => {
    clearCloexec(plan.inventories.coordinator, 6);
    const observer = driver();
    expectPending(observer);
    expectPending(observer);
    restoreCloexec(plan.inventories.coordinator, 6);
    const outcome = attempt(() => observer.sample());
    expect(outcome.error).toBeUndefined();
    expect(outcome.value).toBe(true);
    expect(observer.phase('coordinator-precompile')).toBe(
      plan.inventories.coordinator,
    );
  });

  for (const [label, mutate] of corruptions)
    it(`CS05 ${label} stays hard with one CLOEXEC bit cleared`, () => {
      clearCloexec(plan.inventories.coordinator, 4);
      mutate();
      hardRefusal(attempt(() => driver().sample()));
    });

  it('CS06 an unqualified missing bit beside a compiler is hard, not pending', () => {
    io.state.childrenOfI = [plan.captures.compiler.process.pid];
    clearCloexec(plan.inventories.coordinator, 3);
    hardRefusal(attempt(() => driver().sample()));
  });

  it('CS07 the latch survives an incomplete compiler observation and stays hard', () => {
    io.state.childrenOfI = [plan.captures.compiler.process.pid];
    plan.captures.compiler.process.executable =
      plan.captures.coordinator.process.executable;
    plan.captures.compiler.argv = plan.captures.coordinator.argv;
    plan.captures.compiler.cwd = plan.root;
    const observer = driver();
    const incomplete = attempt(() => observer.sample());
    expect(
      incomplete.error,
      'a valid lease, then only the planned compiler race',
    ).toBeUndefined();
    expect(incomplete.value).toBe(false);
    expect(io.state.compilerCaptures).toBeGreaterThan(0);
    expect(observer.phase('coordinator-precompile')).toBeUndefined();
    io.state.childrenOfI = [];
    clearCloexec(plan.inventories.coordinator, 7);
    hardRefusal(attempt(() => observer.sample()));
  });

  it('CS08 postAdoption hard-fails a cleared bit only after a valid positive', () => {
    const observer = driver();
    const coordinator = plan.captures.coordinator.process.pid;
    io.state.childrenOfC = [];
    expect(attempt(() => observer.sample()).value).toBe(true);
    expect(observer.phase('owner-leased')).toBe(plan.inventories.owner);
    io.state.childrenOfC = [coordinator];
    expect(attempt(() => observer.sample()).value).toBe(true);
    expect(observer.phase('coordinator-precompile')).toBe(
      plan.inventories.coordinator,
    );
    io.state.childrenOfI = [plan.captures.compiler.process.pid];
    expect(attempt(() => observer.sample()).value).toBe(true);
    expect(observer.phase('lease-compiler-live')).toBe(
      plan.inventories.compiler,
    );
    io.state.childrenOfI = [];
    expect(attempt(() => observer.postAdoption()).value).toBe(true);
    expect(observer.phase('coordinator-adopted')).toBe(
      plan.inventories.coordinator,
    );
    clearCloexec(plan.inventories.coordinator, 10);
    hardRefusal(attempt(() => observer.postAdoption()));
  });

  for (const fd of [3, 4, 5, 6, 7, 8, 9, 10])
    it(`CS09 a qualified coordinator losing FD${fd} CLOEXEC is hard`, () => {
      const observer = driver();
      const first = attempt(() => observer.sample());
      expect(first.error).toBeUndefined();
      expect(first.value).toBe(true);
      expect(observer.phase('coordinator-precompile')).toBe(
        plan.inventories.coordinator,
      );
      clearCloexec(plan.inventories.coordinator, fd);
      hardRefusal(attempt(() => observer.sample()));
    });
});

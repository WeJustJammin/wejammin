import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Pure mocked unit controls for the production facts(pid) classifier. node:fs
// lstat/readlink and artifacts.kernelText are mocked on strict planned paths;
// the actual facts/observationRace run. No /proc, native, kernel or DB
// evidence. This is a preparatory RED for Z/X terminal-state deferral.

type Facts = {
  pid: number;
  ppid: number;
  group: number;
  session: number;
  startTime: string;
  uid: number;
  image: string;
  namespace: string;
};
type FactsFn = (pid: number) => Facts;
type RaceFn = (error: unknown) => boolean;

const PID = 501;
const IMAGE = '/unit/node';
const NAMESPACE = 'pid:[700]';
const IDENTITY = 'DEC203_SUPERVISOR_IDENTITY_CHANGED';
const HISTORY = 'DEC203_SUPERVISOR_HISTORY_GAP';
const REFUSED = 'DEC203_SUPERVISOR_REFUSED';

const io = vi.hoisted(() => ({
  lstat: vi.fn<(path: string) => { uid: number }>(),
  link: vi.fn<(path: string) => string>(),
  text: vi.fn<(path: string, limit?: number) => string>(),
}));

vi.mock('node:fs', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  lstatSync: io.lstat,
  readlinkSync: io.link,
}));

vi.mock(
  '../../infra/database-upgrades/native-tracing/receiving-bootstrap-artifacts.mjs',
  async (original) => ({
    ...(await original<Record<string, unknown>>()),
    kernelText: io.text,
  }),
);

let facts: FactsFn;
let observationRace: RaceFn;
let raw = '';
let owner = 1000;

const ZERO_FIELDS = Array<string>(15).fill('0');
const TAIL = `500 501 501 ${ZERO_FIELDS.join(' ')} 9001`;
const noPrefix = (s: string): string => `9 (node fixture) ${s} ${TAIL}`;
const noDelim = (s: string): string => `${PID} node fixture ${s} ${TAIL}`;

type StatSpec = {
  state?: string;
  ppid?: string;
  group?: string;
  session?: string;
  startTime?: string;
  fields?: string[];
  raw?: string;
};

const record = (spec: StatSpec): string => {
  if (spec.raw !== undefined) return spec.raw;
  const fields = spec.fields ?? [
    spec.state ?? 'S',
    spec.ppid ?? '500',
    spec.group ?? '501',
    spec.session ?? '501',
    ...ZERO_FIELDS,
    spec.startTime ?? '9001',
  ];
  return `${PID} (node fixture) ${fields.join(' ')}`;
};

const plan = (spec: StatSpec, uid = 1000): void => {
  raw = record(spec);
  owner = uid;
};

const EXACT = (): Facts => ({
  pid: PID,
  ppid: 500,
  group: 501,
  session: 501,
  startTime: '9001',
  uid: 1000,
  image: IMAGE,
  namespace: NAMESPACE,
});

type Outcome = { value?: Facts; error?: unknown };

const attempt = (action: () => Facts): Outcome => {
  try {
    return { value: action() };
  } catch (error) {
    return { error };
  }
};

const hardRefusal = (outcome: Outcome, code: string): void => {
  expect(outcome.value, 'no facts may be returned').toBeUndefined();
  expect(outcome.error, 'coded supervisor failure').toBeInstanceOf(Error);
  expect(outcome.error).toMatchObject({ code, message: code });
  expect(
    (outcome.error as { incompleteSnapshot?: unknown }).incompleteSnapshot,
  ).toBeUndefined();
};

const incomplete = (outcome: Outcome): void => {
  expect(outcome.value, 'no facts may be returned').toBeUndefined();
  expect(outcome.error, 'coded supervisor failure').toBeInstanceOf(Error);
  expect(outcome.error).toMatchObject({ code: HISTORY, message: HISTORY });
  expect(
    (outcome.error as { incompleteSnapshot?: unknown }).incompleteSnapshot,
  ).toBe(true);
  expect(observationRace(outcome.error)).toBe(true);
};

const noMetadata = (): void => {
  expect(io.lstat).not.toHaveBeenCalled();
  expect(io.link).not.toHaveBeenCalled();
};

const live = (): Facts => facts(PID);

beforeAll(async () => {
  const base = '../../infra/database-upgrades/native-tracing/';
  const processes: unknown = await import(
    new URL(`${base}receiving-bootstrap-processes.mjs`, import.meta.url).href
  );
  const observe: unknown = await import(
    new URL(`${base}receiving-bootstrap-observe.mjs`, import.meta.url).href
  );
  const factsExport = (processes as Record<string, unknown>).facts;
  expect(factsExport, 'actual production facts').toBeTypeOf('function');
  facts = factsExport as FactsFn;
  const raceExport = (observe as Record<string, unknown>).observationRace;
  expect(raceExport, 'actual observationRace').toBeTypeOf('function');
  observationRace = raceExport as RaceFn;
});

beforeEach(() => {
  vi.clearAllMocks();
  raw = record({});
  owner = 1000;
  io.text.mockImplementation((path: string) => {
    if (path === `/proc/${PID}/stat`) return raw;
    throw new Error('unplanned kernelText path');
  });
  io.lstat.mockImplementation((path: string) => {
    if (path === `/proc/${PID}`) return { uid: owner };
    throw new Error('unplanned lstat path');
  });
  io.link.mockImplementation((path: string) => {
    if (path === `/proc/${PID}/exe`) return IMAGE;
    if (path === `/proc/${PID}/ns/pid`) return NAMESPACE;
    throw new Error('unplanned readlink path');
  });
});

const malformed: readonly (readonly [string, (s: string) => StatSpec])[] = [
  ['a short record', (s) => ({ fields: [s, '500', '501'] })],
  ['a zero-padded field', (s) => ({ state: s, ppid: '01' })],
  ['a nonnumeric field', (s) => ({ state: s, group: 'x9' })],
  ['a zero start time', (s) => ({ state: s, startTime: '0' })],
  ['a negative start time', (s) => ({ state: s, startTime: '-1' })],
  ['a malformed prefix', (s) => ({ raw: noPrefix(s) })],
  ['a missing delimiter', (s) => ({ raw: noDelim(s) })],
];

const ancestry: readonly (readonly [string, StatSpec])[] = [
  ['a zero ppid', { ppid: '0' }],
  ['a negative ppid', { ppid: '-1' }],
  ['a zero group', { group: '0' }],
  ['a negative group', { group: '-1' }],
  ['a zero session', { session: '0' }],
  ['a negative session', { session: '-1' }],
];

describe('DEC203 facts classifier, mocked, not native proof', () => {
  it('PF01 a live S stat returns the exact literal facts', () => {
    plan({ state: 'S' });
    expect(live()).toEqual(EXACT());
    expect(io.lstat).toHaveBeenCalledWith(`/proc/${PID}`);
    expect(io.link).toHaveBeenCalledWith(`/proc/${PID}/exe`);
    expect(io.link).toHaveBeenCalledWith(`/proc/${PID}/ns/pid`);
  });

  it('PF02 a live R stat returns the exact literal facts', () => {
    plan({ state: 'R' });
    expect(live()).toEqual(EXACT());
  });

  for (const state of ['Z', 'X'])
    it(`PF03 valid ${state} defers as incomplete with no metadata`, () => {
      plan({ state });
      incomplete(attempt(live));
      noMetadata();
    });

  for (const state of ['Z', 'X'])
    for (const [label, spec] of malformed)
      it(`PF04 ${label} with state ${state} stays hard identity`, () => {
        plan(spec(state));
        hardRefusal(attempt(live), IDENTITY);
        noMetadata();
      });

  for (const [label, state] of [
    ['a nonletter', '1'],
    ['a multiletter', 'ZZ'],
  ] as const)
    it(`PF05 ${label} state stays hard identity`, () => {
      plan({ state });
      hardRefusal(attempt(live), IDENTITY);
      noMetadata();
    });

  it('PF06 a wrong live uid stays hard identity', () => {
    plan({ state: 'S' }, 1001);
    hardRefusal(attempt(live), IDENTITY);
  });

  for (const [label, spec] of ancestry)
    it(`PF07 ${label} on a live stat stays hard identity`, () => {
      plan({ state: 'S', ...spec });
      hardRefusal(attempt(live), IDENTITY);
    });

  for (const state of ['Z', 'X'])
    for (const [label, spec] of ancestry)
      it(`PF08 ${label} with state ${state} stays hard without reads`, () => {
        plan({ state, ...spec });
        hardRefusal(attempt(live), IDENTITY);
        noMetadata();
      });

  for (const pid of [0, -1, 1.5])
    it(`PF09 invalid requested pid ${pid} is refused with no reads`, () => {
      const outcome = attempt(() => facts(pid));
      hardRefusal(outcome, REFUSED);
      expect(io.text).not.toHaveBeenCalled();
      noMetadata();
    });

  for (const state of ['Z', 'X'])
    it(`PF10 a live S then a ${state} read stays incomplete`, () => {
      plan({ state: 'S' });
      const first = live();
      expect(first).toEqual(EXACT());
      const links = io.link.mock.calls.length;
      const lstats = io.lstat.mock.calls.length;
      plan({ state });
      incomplete(attempt(live));
      expect(io.link.mock.calls.length).toBe(links);
      expect(io.lstat.mock.calls.length).toBe(lstats);
      expect(first).toEqual(EXACT());
      incomplete(attempt(live));
      expect(io.link.mock.calls.length).toBe(links);
    });
});

import { describe, expect, it } from 'vitest';

import {
  bindingApi,
  ingressFixture,
  noProcess,
  profilePremises,
} from './phase-02-slice-11-dec203-ingress-fixtures';

const parts = ['parent', 'socket'] as const;
type Part = (typeof parts)[number];
type Fixture = Awaited<ReturnType<typeof ingressFixture>>;
type Event = { method: string; path: string; order: number; bigint?: boolean };
const paths = {
  parent: '/unit/dec203-private-01',
  socket: '/unit/dec203-private-01/docker.sock',
};
const initial = { parent: 9007199254740997n, socket: 9007199254741009n };
const changed = { parent: 9007199254740996n, socket: 9007199254741008n };

function ordered(f: Fixture): Event[] {
  return [
    ...f.fs.lstat.mock.calls.map(([path, options], index) => ({
      method: 'lstat',
      path,
      bigint: options?.bigint,
      order: f.fs.lstat.mock.invocationCallOrder[index]!,
    })),
    ...(['realpath', 'readFile', 'stat'] as const).flatMap((method) =>
      f.fs[method].mock.calls.map(([path], index) => ({
        method,
        path,
        order: f.fs[method].mock.invocationCallOrder[index]!,
      })),
    ),
  ].sort((a, b) => a.order - b.order);
}

const isBody = (event: Event) =>
  event.path !== paths.parent && event.path !== paths.socket;
const body = (f: Fixture) =>
  ordered(f)
    .filter(isBody)
    .map(({ method, path, bigint }) => ({ method, path, bigint }));
const filePaths = (f: Fixture) =>
  [...Object.values(f.binding.executables), f.binding.artifacts.launcher].map(
    ({ path }) => path,
  );

async function prepared() {
  const api = await bindingApi();
  const f = await ingressFixture();
  profilePremises(f);
  const pin = JSON.stringify(f.binding);
  expect(api.assertBinding(f.binding)).toBeUndefined();
  await expect(api.verifyExecutables(f.fs, f.binding)).resolves.toBeUndefined();
  expect(JSON.stringify(f.binding)).toBe(pin);
  noProcess(f);
  const baseline = body(f);
  for (const spy of Object.values(f.fs)) spy.mockClear();
  return { api, f, pin, baseline };
}

function images(f: Fixture, part: Part) {
  const values: unknown[] = [];
  const original = f.fs.lstat.getMockImplementation()!;
  f.fs.lstat.mockImplementation(async (path, options) => {
    const value = await original(path, options);
    if (path === paths[part]) values.push(value.ino);
    return value;
  });
  return values;
}

async function refusal(
  api: Awaited<ReturnType<typeof bindingApi>>,
  f: Fixture,
  pin: string,
) {
  const failure = await api.verifyExecutables(f.fs, f.binding).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(Error);
  expect(String(failure)).not.toContain('DEC197_LOCAL_HOST_');
  expect(JSON.stringify(f.binding)).toBe(pin);
  expect(api.assertBinding(f.binding)).toBeUndefined();
  noProcess(f);
}

describe('DEC203 observed ingress rounds, injected FS only', () => {
  it('IO01 audits both complete rounds around unchanged executable verification', async () => {
    const { api, f, pin, baseline } = await prepared();
    await expect(
      api.verifyExecutables(f.fs, f.binding),
    ).resolves.toBeUndefined();
    const events = ordered(f);
    const middle = events.filter(isBody);
    expect(middle.length).toBeGreaterThan(0);
    expect(body(f)).toEqual(baseline);
    expect(f.fs.readFile.mock.calls.map(([path]) => path)).toEqual(
      filePaths(f),
    );
    expect(f.fs.realpath.mock.calls.map(([path]) => path)).toContain('/bin/sh');
    expect(f.fs.realpath.mock.calls.map(([path]) => path)).toContain(
      f.binding.artifacts.launcher.invokedPath,
    );
    for (const part of parts) {
      const seen = events.filter((event) => event.path === paths[part]);
      const before = seen.filter((event) => event.order < middle[0]!.order);
      const after = seen.filter((event) => event.order > middle.at(-1)!.order);
      expect(seen).toHaveLength(6);
      for (const round of [before, after]) {
        expect(round.map(({ method }) => method)).toEqual([
          'lstat',
          'realpath',
          'lstat',
        ]);
        expect(
          round
            .filter(({ method }) => method === 'lstat')
            .map(({ bigint }) => bigint),
        ).toEqual([true, true]);
      }
    }
    expect(JSON.stringify(f.binding)).toBe(pin);
    noProcess(f);
  });

  it.each(parts)(
    'IO02 %s identity changes inside lstat-realpath-lstat',
    async (part) => {
      const { api, f, pin } = await prepared();
      expect(f.raw[part].inode).toBe(initial[part]);
      expect(Number(initial[part])).toBe(Number(changed[part]));
      const snapshots = images(f, part);
      const original = f.fs.realpath.getMockImplementation()!;
      let drifted = false;
      let resolved: string | undefined;
      f.fs.realpath.mockImplementation(async (path) => {
        const value = await original(path);
        if (path === paths[part] && !drifted) {
          resolved = value;
          f.raw[part].inode = changed[part];
          drifted = true;
        }
        return value;
      });
      await refusal(api, f, pin);
      expect(drifted).toBe(true);
      expect(resolved).toBe(paths[part]);
      expect(f.raw[part].inode).toBe(changed[part]);
      expect(snapshots).toEqual([initial[part], changed[part]]);
      const seen = ordered(f).filter((event) => event.path === paths[part]);
      expect(seen.map(({ method }) => method)).toEqual([
        'lstat',
        'realpath',
        'lstat',
      ]);
      expect(
        seen
          .filter(({ method }) => method === 'lstat')
          .map(({ bigint }) => bigint),
      ).toEqual([true, true]);
      expect(f.fs.readFile).not.toHaveBeenCalled();
    },
  );

  it.each(parts)(
    'IO03 %s identity changes during an actual artifact read',
    async (part) => {
      const { api, f, pin, baseline } = await prepared();
      expect(f.raw[part].inode).toBe(initial[part]);
      expect(Number(initial[part])).toBe(Number(changed[part]));
      const snapshots = images(f, part);
      const original = f.fs.readFile.getMockImplementation()!;
      let readPath: string | undefined;
      let atDrift: Event[] = [];
      f.fs.readFile.mockImplementation(async (...args) => {
        const bytes = await original(...args);
        if (readPath === undefined) {
          readPath = args[0];
          atDrift = ordered(f);
          f.raw[part].inode = changed[part];
        }
        return bytes;
      });
      await refusal(api, f, pin);
      expect(filePaths(f)).toContain(readPath);
      expect(f.raw[part].inode).toBe(changed[part]);
      expect(
        atDrift.filter(({ method }) => method === 'readFile'),
      ).toHaveLength(1);
      for (const observed of parts) {
        const before = atDrift.filter(
          (event) => event.path === paths[observed],
        );
        expect(before.map(({ method }) => method)).toEqual([
          'lstat',
          'realpath',
          'lstat',
        ]);
        expect(
          before
            .filter(({ method }) => method === 'lstat')
            .map(({ bigint }) => bigint),
        ).toEqual([true, true]);
      }
      expect(body(f)).toEqual(baseline);
      expect(f.fs.readFile.mock.calls.map(([path]) => path)).toEqual(
        filePaths(f),
      );
      expect(snapshots.slice(0, 3)).toEqual([
        initial[part],
        initial[part],
        changed[part],
      ]);
      const events = ordered(f);
      const lastBody = events.filter(isBody).at(-1)!;
      expect(
        events
          .filter(
            (event) => event.path === paths[part] && event.method === 'lstat',
          )
          .at(-1)!.order,
      ).toBeGreaterThan(lastBody.order);
      expect(
        f.fs.lstat.mock.calls
          .filter(([path]) => path === paths[part])
          .every(([, options]) => options?.bigint === true),
      ).toBe(true);
    },
  );
});

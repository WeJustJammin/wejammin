import { Buffer } from 'node:buffer';
import { basename, join } from 'node:path';

import { describe, expect } from 'vitest';

import {
  apiCase,
  digest,
  input,
  promoted,
  repository,
  target,
  type Mode,
  type PlanInput,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import { expectedInvocation } from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

// Source-only unit decisions. Neither these fixtures nor a mocked pass proves DDL.
const reader =
  (bytes?: Buffer) =>
  (path: string): Buffer | undefined => {
    if (path === promoted) return bytes;
    throw new Error(`unexpected source ${path}`);
  };

describe('DEC-197 pure upgrade decisions', () => {
  apiCase('DR-UR-S01 promoted source returns exact bytes and digest', (api) => {
    const bytes = input().witness;
    expect(
      api.resolveMigrationSource({
        repository,
        readOptional: reader(bytes),
      }),
    ).toEqual({ path: promoted, bytes, sha256: digest(bytes) });
  });
  // DR-UR-S04 replaces the retired DR-UR-S02 (rewritten when the WIP twin ended); the old id is not reused.
  apiCase(
    'DR-UR-S04 a source path outside the promoted directory is refused',
    (api) => {
      const original = input();
      expect(() =>
        api.buildUpgradePlan({
          ...original,
          source: {
            ...original.source,
            path: join(
              repository,
              'supabase/migrations-wip/dec197',
              basename(promoted),
            ),
          },
        }),
      ).toThrow('foreign source path');
    },
  );
  apiCase(
    'DR-UR-S03 missing sources refuse; read errors are not fallback',
    (api) => {
      expect(() =>
        api.resolveMigrationSource({ repository, readOptional: reader() }),
      ).toThrow();
      const denied = new Error('EACCES unit source denial');
      expect(() =>
        api.resolveMigrationSource({
          repository,
          readOptional: () => {
            throw denied;
          },
        }),
      ).toThrow(denied);
    },
  );
  apiCase(
    'DR-UR-P01 binds exact source/copy/prefix bytes and sealed ALT target',
    (api) => {
      const original = input();
      const plan = api.buildUpgradePlan(original);
      expect(plan).toMatchObject({
        target: original.target,
        mode: 'negative',
        sourceSha256: digest(original.source.bytes),
        witnessSha256: digest(original.witness),
      });
      const manifest = original.prefixManifest.entries
        .map((entry) => {
          if (!entry.bytes) throw new Error('missing prefix bytes');
          return `${basename(entry.path)}\t${digest(entry.bytes)}\n`;
        })
        .join('');
      expect(plan.prefixSha256).toBe(digest(Buffer.from(manifest)));
      expect(plan.prefixSha256).toBe(
        api.buildUpgradePlan(input()).prefixSha256,
      );
      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(plan.prefixManifest.entries)).toBe(true);
      expect(Object.isFrozen(plan.target)).toBe(true);
      expect(Object.isFrozen(plan.target.locks)).toBe(true);
      expect(Object.isFrozen(plan.target.locks[0])).toBe(true);
      const lockPath = plan.target.locks[0]?.path;
      if (!original.target.locks[0]) throw new Error('missing unit lock');
      original.target.locks[0].path = '/tmp/foreign.lock';
      expect(plan.target.locks[0]?.path).toBe(lockPath);
      const bound = Buffer.from(plan.source.bytes);
      original.source.bytes[0] = 0;
      original.witness[0] = 0;
      expect(plan.source.bytes.equals(bound)).toBe(true);
      expect(plan.witness.equals(bound)).toBe(true);
      const prefix = plan.prefixManifest.entries.at(0)?.bytes;
      const callerPrefix = original.prefixManifest.entries.at(0)?.bytes;
      if (!prefix || !callerPrefix)
        throw new Error('missing actual prefix fixture');
      const boundPrefix = Buffer.from(prefix);
      callerPrefix[0] = 0;
      expect(prefix.equals(boundPrefix)).toBe(true);
      expect(api.buildUpgradePlan(input('positive')).target).toEqual(
        plan.target,
      );
    },
  );
  const byteMutations: Array<[string, (b: Buffer) => Buffer]> = [
    [
      'header',
      (b) => Buffer.from(b.toString().replace('-- DEC-197', '-- DEC-19X')),
    ],
    [
      'body',
      (b) =>
        Buffer.from(b.toString().replace('version_no > 0', 'version_no > 1')),
    ],
    ['BEGIN', (b) => Buffer.from(b.toString().replace('begin;\n', ''))],
    ['COMMIT', (b) => Buffer.from(b.toString().replace('commit;\n', ''))],
    ['final LF', (b) => b.subarray(0, b.length - 1)],
  ];
  for (const [name, mutate] of byteMutations) {
    apiCase(`DR-UR-P02 ${name} copy drift refuses before IO`, (api) => {
      const data = input();
      data.witness = mutate(data.witness);
      expect(data.witness.equals(data.source.bytes)).toBe(false);
      expect(() => api.buildUpgradePlan(data)).toThrow();
    });
  }
  const badPlans: Array<[string, (p: PlanInput) => void]> = [
    [
      'missing prefix file bytes',
      (p) => {
        const e = p.prefixManifest.entries.at(0);
        if (e) e.bytes = undefined;
      },
    ],
    [
      'changed prefix hash',
      (p) => {
        const e = p.prefixManifest.entries.at(0);
        if (e) e.sha256 = '0'.repeat(64);
      },
    ],
    [
      'missing prefix entry',
      (p) => {
        p.prefixManifest.entries.pop();
      },
    ],
    [
      'missing expected inventory entry',
      (p) => {
        p.prefixManifest.expectedPaths.pop();
      },
    ],
    [
      'duplicate prefix',
      (p) => {
        const e = p.prefixManifest.entries.at(0);
        if (e) {
          p.prefixManifest.entries.push(e);
          p.prefixManifest.expectedPaths.push(e.path);
        }
      },
    ],
    [
      'duplicate version under another filename',
      (p) => {
        const e = p.prefixManifest.entries.at(0);
        if (!e) throw new Error('missing actual prefix fixture');
        const path = e.path.replace(
          /(\d{14})_[^/]+\.sql$/,
          '$1_zz_duplicate.sql',
        );
        p.prefixManifest.entries.push({ ...e, path });
        p.prefixManifest.entries.sort((a, b) => a.path.localeCompare(b.path));
        p.prefixManifest.expectedPaths = p.prefixManifest.entries.map(
          (entry) => entry.path,
        );
      },
    ],
    [
      'unsorted prefix',
      (p) => {
        p.prefixManifest.entries.reverse();
        p.prefixManifest.expectedPaths.reverse();
      },
    ],
    [
      'target included',
      (p) => {
        p.prefixManifest.entries.push({ ...p.source, path: promoted });
        p.prefixManifest.expectedPaths.push(promoted);
      },
    ],
    [
      'later included',
      (p) => {
        const path = promoted.replace('20261016', '20261017');
        p.prefixManifest.entries.push({ ...p.source, path });
        p.prefixManifest.expectedPaths.push(path);
      },
    ],
    [
      'stale source digest',
      (p) => {
        p.source.sha256 = '0'.repeat(64);
      },
    ],
    [
      'unknown mode',
      (p) => {
        p.mode = 'other' as Mode;
      },
    ],
    [
      'unknown target',
      (p) => {
        p.targetMigration = target.replace('20261016', '20261017');
      },
    ],
    [
      'unsafe container',
      (p) => {
        p.target.container = 'stack; sh';
      },
    ],
    [
      'empty run ID',
      (p) => {
        p.runId = '';
      },
    ],
    [
      'path run ID',
      (p) => {
        p.runId = '../unit';
      },
    ],
  ];
  for (const name of [
    'template0',
    '',
    'other_owner',
    'dec197_upgrade_unit_positive',
    'db;DROP',
    'x'.repeat(64),
  ]) {
    badPlans.push([
      `foreign or truncated DB ${name}`,
      (p) => {
        p.target.database = name;
      },
    ]);
  }
  for (const [name, mutate] of badPlans) {
    apiCase(`DR-UR-P03 ${name} fails closed`, (api) => {
      const data = input();
      expect(data.prefixManifest.entries.length).toBeGreaterThan(1);
      mutate(data);
      expect(() => api.buildUpgradePlan(data)).toThrow();
    });
  }
  for (const mode of ['negative', 'positive'] as const) {
    apiCase(
      `DR-UR-I01 ${mode} streams full bytes without shell/transaction wrapper`,
      (api) => {
        const plan = api.buildUpgradePlan(input(mode));
        const script = Buffer.from(plan.witness);
        const invocation = api.buildPsqlInvocation({ ...plan, script });
        expect(invocation).toEqual(expectedInvocation(plan));
        expect(invocation.input.equals(plan.witness)).toBe(true);
        script[0] = 0;
        expect(invocation.input.equals(plan.witness)).toBe(true);
      },
    );
  }
  apiCase(
    'DR-UR-I02 invocation refuses bare postgres, target and metadata injection',
    (api) => {
      const data = {
        ...api.buildUpgradePlan(input()),
        script: input().witness,
      };
      const { target: omitted, ...bare } = data;
      expect(omitted.database).toBe('postgres');
      expect(() =>
        api.buildPsqlInvocation({
          ...bare,
          container: omitted.container,
          database: 'postgres',
        } as unknown as Parameters<typeof api.buildPsqlInvocation>[0]),
      ).toThrow();
      for (const patch of [
        { target: { ...data.target, database: 'foreign' } },
        { target: { ...data.target, container: 'stack\nsh' } },
        { applicationName: 'upgrade\nCOMMIT' },
        { applicationName: 'x'.repeat(64) },
        { applicationName: `${'é'.repeat(31)}xx` },
        { mode: 'other' as Mode },
      ]) {
        expect(() => api.buildPsqlInvocation({ ...data, ...patch })).toThrow();
      }
      for (const applicationName of ['x'.repeat(63), `${'é'.repeat(31)}x`]) {
        expect(api.buildPsqlInvocation({ ...data, applicationName })).toEqual(
          expectedInvocation({ ...data, applicationName }),
        );
      }
    },
  );
});

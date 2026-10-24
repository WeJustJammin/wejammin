import { describe, expect } from 'vitest';

import {
  apiCase,
  committed,
  compositeFk,
  directFk,
  input,
  refusal,
  world,
  type Execution,
  type Obj,
  type PlanInput,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import { before } from './phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures';
import {
  marker,
  session,
} from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

// apiCase loads future implementation inside cases, never during collection.
describe('DEC-197 source-only upgrade outcome decisions (not DDL proof)', () => {
  apiCase(
    'DR-UR-O01 only intended direct-FK refusal and aborted tail is controlled',
    (api) => {
      expect(
        api.classifyMigrationOutcome({ ...refusal(), mode: 'negative' }),
      ).toMatchObject({
        expected: true,
        firstSqlstate: '23503',
        constraint: directFk,
        transactionTag: 'ROLLBACK',
      });
      expect(
        api.classifyMigrationOutcome({ ...committed(), mode: 'positive' }),
      ).toMatchObject({
        expected: true,
        transactionTag: 'COMMIT',
      });
      expect(
        api.classifyMigrationOutcome({
          ...committed(),
          mode: 'positive',
          stderr: 'NOTICE: benign unit diagnostic\n',
        }).expected,
      ).toBe(true);
    },
  );
  const badOutcomes: Array<[string, (e: Execution) => void]> = [
    [
      'missing terminal tag',
      (e) => {
        e.stdout = 'BEGIN\n';
      },
    ],
    [
      'unexpected success',
      (e) => {
        Object.assign(e, committed());
      },
    ],
    [
      'wrong first SQLSTATE',
      (e) => {
        e.stderr = e.stderr.replace('23503', '42P01');
      },
    ],
    [
      'wrong constraint',
      (e) => {
        e.stderr = e.stderr.replaceAll(directFk, compositeFk);
      },
    ],
    [
      'constraint only in misleading detail',
      (e) => {
        e.stderr =
          e.stderr.replaceAll(directFk, 'other_fk') +
          `DETAIL: mentions ${directFk}\n`;
      },
    ],
    [
      'unexpected subsequent error',
      (e) => {
        e.stderr += 'ERROR:  42P07: duplicate table\n';
      },
    ],
    [
      'only aborted-transaction error',
      (e) => {
        e.stderr = 'ERROR:  25P02: aborted\n';
      },
    ],
    [
      'connection status',
      (e) => {
        e.status = 2;
      },
    ],
    [
      'nonfinal rollback',
      (e) => {
        e.stdout += 'COMMIT\n';
      },
    ],
  ];
  for (const [name, mutate] of badOutcomes) {
    apiCase(`DR-UR-O02 ${name} is not expected negative`, (api) => {
      const result = refusal();
      mutate(result);
      expect(
        api.classifyMigrationOutcome({ ...result, mode: 'negative' }).expected,
      ).toBe(false);
    });
  }
  apiCase(
    'DR-UR-O03 positive requires status zero, final COMMIT and no SQL error',
    (api) => {
      for (const patch of [
        { status: 3 },
        { stdout: 'BEGIN\nROLLBACK\n' },
        { stdout: 'BEGIN\n' },
        { stderr: refusal().stderr },
        { stderr: 'ERROR: unknown non-verbose diagnostic\n' },
      ]) {
        expect(
          api.classifyMigrationOutcome({
            ...committed(),
            ...patch,
            mode: 'positive',
          }).expected,
        ).toBe(false);
      }
    },
  );
  const badTargets: Array<[string, (p: PlanInput) => void]> = [
    [
      'missing descriptor',
      (p) => {
        Reflect.deleteProperty(p, 'target');
      },
    ],
    [
      'foreign kind',
      (p) => {
        p.target.kind = 'generic-postgres';
      },
    ],
    [
      'default project',
      (p) => {
        p.target.projectId = 'wejammin';
      },
    ],
    [
      'primary workdir',
      (p) => {
        p.target.workdir = '/home/rob/Projects/WeJammin';
      },
    ],
    [
      'relative workdir',
      (p) => {
        p.target.workdir = 'orchestration/altdb';
      },
    ],
    [
      'default container',
      (p) => {
        p.target.container = 'supabase_db_wejammin';
      },
    ],
    [
      'default DB port',
      (p) => {
        p.target.dbPort = 54322;
      },
    ],
    [
      'default API port',
      (p) => {
        p.target.apiPort = 54321;
      },
    ],
    [
      'missing fourth lock',
      (p) => {
        p.target.locks.pop();
      },
    ],
    [
      'reordered locks',
      (p) => {
        p.target.locks.reverse();
      },
    ],
    [
      'exclusive quiet lock',
      (p) => {
        const lock = p.target.locks[1];
        if (lock) lock.mode = 'exclusive';
      },
    ],
    [
      'summary-derived wrong reset lock',
      (p) => {
        const lock = p.target.locks[3];
        if (lock) lock.path = '/tmp/wejammin-supabase-reset.lock';
      },
    ],
    [
      'extra reset authority',
      (p) => {
        Object.assign(p.target, { genericPostgres: true });
      },
    ],
  ];
  for (const [name, mutate] of badTargets) {
    apiCase(`DR-UR-T01 ${name} never seals reset authority`, (api) => {
      const data = input();
      mutate(data);
      expect(() => api.buildUpgradePlan(data)).toThrow();
    });
  }
  const badMarkers: Array<[string, (e: Execution) => void]> = [
    [
      'missing marker',
      (e) => {
        e.stdout = e.stdout.slice(e.stdout.indexOf('\n') + 1);
      },
    ],
    [
      'duplicate marker',
      (e) => {
        e.stdout = e.stdout.split('\n')[0] + '\n' + e.stdout;
      },
    ],
    [
      'malformed JSON',
      (e) => {
        e.stdout = e.stdout.replace('{', '{bad');
      },
    ],
    [
      'wrong witness',
      (e) => {
        e.stdout = e.stdout.replace('DEC197_MIGRATION_SESSION_V1', 'OTHER');
      },
    ],
    [
      'noninteger PID',
      (e) => {
        e.stdout = e.stdout.replace('"backendPid":301', '"backendPid":1.5');
      },
    ],
    [
      'zero PID',
      (e) => {
        e.stdout = e.stdout.replace('"backendPid":301', '"backendPid":0');
      },
    ],
    [
      'numeric OID',
      (e) => {
        e.stdout = e.stdout.replace('"databaseOid":"5"', '"databaseOid":5');
      },
    ],
    [
      'missing application',
      (e) => {
        e.stdout = e.stdout.replace('dec197_upgrade_unit_negative', '');
      },
    ],
  ];
  for (const [name, mutate] of badMarkers) {
    apiCase(
      `DR-UR-O04 ${name} cannot authenticate migration session`,
      (api) => {
        const result = refusal();
        mutate(result);
        expect(
          api.classifyMigrationOutcome({ ...result, mode: 'negative' })
            .expected,
        ).toBe(false);
      },
    );
  }
  apiCase(
    'DR-UR-O05 actual marker JSON is parsed independently of key order',
    (api) => {
      const result = refusal();
      const value = session('dec197_upgrade_unit_negative');
      const { applicationName, backendPid, databaseOid, database, witness } =
        value;
      result.stdout =
        JSON.stringify(
          { applicationName, backendPid, databaseOid, database, witness },
          null,
          0,
        ) +
        '\n' +
        result.stdout.slice(result.stdout.indexOf('\n') + 1);
      expect(
        api.classifyMigrationOutcome({ ...result, mode: 'negative' }),
      ).toMatchObject({ expected: true, session: value });
    },
  );
  for (const [name, phase, key, value] of [
    ['nondecimal attested DB OID', 'prefix', 'databaseOid', 'not-an-oid'],
    ['missing cluster identity', 'prefix', 'clusterId', ''],
    ['reset cluster mismatch', 'reset', 'clusterId', 'foreign'],
    ['empty reset epoch', 'reset', 'resetEpoch', ''],
    ['setup epoch mismatch', 'setup', 'resetEpoch', 'stale'],
    ['before epoch mismatch', 'beforeEnvelope', 'resetEpoch', 'stale'],
    ['migration epoch mismatch', 'execution', 'resetEpoch', 'stale'],
    ['after epoch mismatch', 'afterEnvelope', 'resetEpoch', 'stale'],
    [
      'restore repeats prefix epoch',
      'restored',
      'resetEpoch',
      'unit-prefix-negative',
    ],
    ['restore cluster mismatch', 'restored', 'clusterId', 'foreign'],
    ['restore OID mismatch', 'restored', 'databaseOid', '99'],
    ['restore wrong baseline', 'restored', 'baselineSha256', '0'.repeat(64)],
  ] as const) {
    apiCase(`DR-UR-T02 ${name} cannot produce a receipt`, async (api) => {
      const plan = api.buildUpgradePlan(input());
      const mock = world(plan, {
        before: before(),
        after: before('negative', 202),
      });
      Object.assign(mock.outputs[phase] as Obj, { [key]: value });
      await expect(
        api.runReceivingUpgrade({ io: mock.io, plan }),
      ).rejects.toThrow();
      expect(mock.receipts).toEqual([]);
      if (phase === 'prefix') {
        expect(mock.events).toEqual(['preparePrefix']);
      } else {
        expect(mock.events.at(-1)).toBe('restoreBaseline');
      }
    });
  }
  for (const [name, patch] of [
    ['application mismatch', { applicationName: 'foreign_app' }],
    ['database mismatch', { database: 'foreign' }],
    ['database OID mismatch', { databaseOid: '99' }],
  ] as const) {
    apiCase(
      `DR-UR-T03 migration marker ${name} is not caller metadata`,
      async (api) => {
        const plan = api.buildUpgradePlan(input());
        const mock = world(plan, {
          before: before(),
          after: before('negative', 202),
        });
        mock.outputs.execution.stdout = mock.outputs.execution.stdout.replace(
          marker(session(plan.applicationName)),
          marker({ ...session(plan.applicationName), ...patch }),
        );
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan }),
        ).rejects.toThrow();
        expect(mock.events).toContain('executeMigration');
        expect(mock.events.at(-1)).toBe('restoreBaseline');
        expect(mock.receipts).toEqual([]);
      },
    );
  }
});

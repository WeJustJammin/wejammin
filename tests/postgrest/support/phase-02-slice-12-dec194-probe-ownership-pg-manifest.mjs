import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  jobsCatalog,
  rowDigest,
} from './phase-02-slice-12-dec194-probe-ownership-pg-catalog.mjs';

export const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeSchema = (state) =>
  state && {
    name: state.namespace.nspname,
    oid: state.namespace.oid,
    functions: state.functions.map((p) => ({ name: p.proname, oid: p.oid })),
    relations: state.classes.map((c) => ({ name: c.relname, oid: c.oid })),
  };

export function openOwnershipManifest({ nonce, target }) {
  const directory = fs.mkdtempSync('/tmp/wejammin-dec194-pg-ownership-');
  const manifest = path.join(directory, 'fixture-manifest.jsonl');
  const fd = fs.openSync(manifest, 'ax', 0o600);
  const fixtures = [];
  let baseline;
  const record = (event) => {
    const row = { run: nonce, ...event };
    fs.writeSync(fd, `${JSON.stringify(row)}\n`);
    fs.fsyncSync(fd);
    console.log(JSON.stringify(row));
  };
  record({
    kind: 'manifest',
    path: manifest,
    target,
    locks: 'root receipts required; not inferred',
  });

  function remember(f, state, ownAbsent = false, changes = {}) {
    assert.deepEqual(
      state.jobs.filter(
        (t) =>
          !fixtures.some((item) =>
            [item.trigger, item.extra].includes(t.row.tgname),
          ),
      ),
      baseline.jobs,
      'Unowned jobs trigger drift',
    );
    if (f.initial) {
      assert.deepEqual(
        state.own,
        ownAbsent ? null : f.initial.own,
        'Owned schema drift',
      );
      assert.deepEqual(
        state.foreign,
        f.initial.foreign,
        'Foreign fixture schema drift',
      );
    } else f.initial = { own: state.own, foreign: state.foreign };
    const current = state.jobs.filter((t) =>
      [f.trigger, f.extra].includes(t.row.tgname),
    );
    const expected = [...f.triggers];
    for (const name of changes.removed ?? []) {
      const index = expected.findIndex((t) => t.row.tgname === name);
      assert.ok(index >= 0, 'Only recorded triggers may be removed');
      expected.splice(index, 1);
    }
    for (const created of changes.created ?? []) {
      assert.ok([f.trigger, f.extra].includes(created.row.tgname));
      const index = expected.findIndex(
        (t) => t.row.tgname === created.row.tgname,
      );
      if (index >= 0) {
        assert.equal(
          Number(created.row.oid),
          Number(expected[index].row.oid),
          'Replacement must retain recorded OID',
        );
        expected.splice(index, 1);
      }
      expected.push(created);
    }
    if (f.acquisition) {
      const t = current.find((item) => item.row.tgname === f.trigger);
      assert.ok(t && !expected.some((item) => item.row.tgname === f.trigger));
      assert.equal(Number(t.row.oid), Number(f.acquisition.oid));
      assert.equal(Number(t.row.tgfoid), Number(f.acquisition.functionOid));
      expected.push(t);
    }
    const byOid = (a, b) => Number(a.row.oid) - Number(b.row.oid);
    assert.deepEqual(
      current,
      expected.sort(byOid),
      'Unrecorded trigger identity, binding, or catalog drift',
    );
    for (const t of current)
      assert.ok(
        [f.ids.functionOid, f.ids.foreignFunctionOid]
          .map(Number)
          .includes(Number(t.row.tgfoid)),
        'Unknown trigger function binding',
      );
    f.acquisition = null;
    f.triggers = current;
    f.state = state;
    record({
      kind: 'fixture-state',
      schema: safeSchema(state.own),
      foreign: safeSchema(state.foreign),
      triggers: f.triggers.map((t) => ({
        name: t.row.tgname,
        oid: t.row.oid,
        functionOid: t.row.tgfoid,
      })),
    });
    return state;
  }
  async function captureBaseline(query) {
    const preflight = await query(
      `select jsonb_build_object('database',current_database(),
      'user',current_user,'jobs','platform_private.jobs'::regclass::text,
      'isolation',current_setting('transaction_isolation'));`,
      'ALT SQL preflight',
    );
    assert.deepEqual(preflight, {
      database: 'postgres',
      user: 'postgres',
      jobs: 'platform_private.jobs',
      isolation: 'read committed',
    });
    baseline = {
      jobs: await query(`select ${jobsCatalog};`, 'original trigger catalog'),
      rows: await query(rowDigest, 'original job digest'),
    };
    record({
      kind: 'baseline',
      triggerCount: baseline.jobs.length,
      triggerDigest: digest(baseline.jobs),
      jobRows: baseline.rows,
    });
  }
  return {
    record,
    fixtures,
    remember,
    captureBaseline,
    get baseline() {
      return baseline;
    },
    close() {
      fs.closeSync(fd);
    },
  };
}

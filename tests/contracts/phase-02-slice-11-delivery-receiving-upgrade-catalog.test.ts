import { describe, expect } from 'vitest';

import {
  foreignKeys,
  receivingCatalog,
} from './phase-02-slice-11-delivery-receiving-upgrade-catalog-fixtures';
import {
  guardBody,
  guardDefinition,
} from './phase-02-slice-11-delivery-receiving-upgrade-catalog-security-fixtures';
import {
  apiCase,
  type Document,
  type Obj,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  afterPositive,
  before,
} from './phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures';

// No DB/import-time implementation calls. These are semantic unit controls only.
const find = (
  doc: Document,
  section: string,
  select: (row: Obj) => boolean,
): Obj => {
  const row = doc.snapshot.catalog[section]?.find(select);
  if (!row) throw new Error(`missing catalog arrangement ${section}`);
  return row;
};
const named = (doc: Document, section: string, name: string): Obj =>
  find(doc, section, (row) => row.name === name);
const reject = (name: string, mutate: (doc: Document) => void): void => {
  apiCase(
    `DR-UR-K02 ${name} cannot pass committed-catalog validation`,
    (api) => {
      const after = afterPositive();
      mutate(after);
      expect(() =>
        api.assertCommittedReceivingCatalog({
          before: before('positive'),
          after,
        }),
      ).toThrow();
    },
  );
};

describe('DEC-197 complete receiving-catalog unit contract', () => {
  apiCase(
    'DR-UR-K01 full 070-shaped semantic control includes legitimate side objects',
    (api) => {
      const old = before('positive');
      const after = afterPositive();
      expect(
        named(after, 'routines', 'route_manifest_version_guard').definition,
      ).toBe(guardDefinition);
      for (const entry of after.snapshot.catalog.constraints ?? []) {
        if (entry.relation === 100 || entry.relation === 101) {
          expect(entry.definition).toEqual(expect.any(String));
        }
      }
      expect(
        after.snapshot.catalog.types?.filter((t) =>
          String(t.name).startsWith('_'),
        ),
      ).toHaveLength(2);
      expect(
        after.snapshot.catalog.columns?.filter((c) => c.relation === 102),
      ).toHaveLength(3);
      expect(
        after.snapshot.catalog.columns?.filter(
          (c) => Number(c.relation) >= 300,
        ),
      ).toHaveLength(22);
      for (const fk of foreignKeys) {
        const triggers = after.snapshot.catalog.triggers?.filter(
          (t) => t.constraint === fk.oid && t.internal,
        );
        expect(triggers).toHaveLength(4);
      }
      expect(
        after.snapshot.catalog.triggers?.some(
          (t) => t.internal && t.relation === 10,
        ),
      ).toBe(true);
      expect(
        after.snapshot.catalog.triggers?.some(
          (t) => t.internal && t.relation === 11,
        ),
      ).toBe(true);
      expect(after.snapshot.consumerRows).toEqual(old.snapshot.consumerRows);
      expect(after.snapshot.publicationVersionRows).toEqual(
        old.snapshot.publicationVersionRows,
      );
      for (const [section, rows] of Object.entries(old.snapshot.catalog)) {
        for (const row of rows)
          expect(after.snapshot.catalog[section]).toContainEqual(row);
      }
      expect(() =>
        api.assertCommittedReceivingCatalog({ before: old, after }),
      ).not.toThrow();
    },
  );

  const constraints = receivingCatalog().constraints ?? [];
  for (const entry of constraints.filter((c) => c.type === 'c')) {
    const name = String(entry.name);
    reject(`${name} missing CHECK definition`, (doc) => {
      delete named(doc, 'constraints', name).definition;
    });
    reject(`${name} weakened CHECK definition`, (doc) => {
      named(doc, 'constraints', name).definition = 'CHECK (true)';
    });
    reject(`${name} unvalidated CHECK`, (doc) => {
      named(doc, 'constraints', name).validated = false;
    });
  }
  reject('positive ordinal admits zero', (doc) => {
    named(
      doc,
      'constraints',
      'route_manifest_version_version_no_check',
    ).definition = 'CHECK ((version_no >= 0))';
  });
  for (const entry of constraints.filter(
    (c) => c.type === 'p' || c.type === 'u',
  )) {
    const name = String(entry.name);
    reject(`${name} missing key despite surviving index`, (doc) => {
      doc.snapshot.catalog.constraints =
        doc.snapshot.catalog.constraints?.filter((c) => c.name !== name) ?? [];
    });
    reject(`${name} wrong key columns`, (doc) => {
      named(doc, 'constraints', name).columns = [99];
    });
    reject(`${name} invalid key definition`, (doc) => {
      named(doc, 'constraints', name).definition = 'UNIQUE (state)';
    });
  }
  const guardMutations: Array<[string, string]> = [
    ['no-op body', 'begin\n  return new;\nend;\n'],
    [
      'disabled delete refusal',
      guardBody.replace("if tg_op = 'DELETE'", "if false and tg_op = 'DELETE'"),
    ],
    [
      'disabled ready entry rule',
      guardBody.replace('if new.state in', 'if false and new.state in'),
    ],
    [
      'disabled transition refusal',
      guardBody.replace('and not ((', 'and false and not (('),
    ],
    [
      'disabled immutable-field refusal',
      guardBody.replace('if row(new.id', 'if false and row(new.id'),
    ],
    [
      'disabled activation write-once',
      guardBody.replace('if old.activated_at', 'if false and old.activated_at'),
    ],
  ];
  for (const [name, body] of guardMutations) {
    reject(name, (doc) => {
      expect(body).not.toBe(guardBody);
      const guard = named(doc, 'routines', 'route_manifest_version_guard');
      expect(String(guard.definition)).toContain(guardBody);
      guard.definition = String(guard.definition).replace(guardBody, body);
    });
  }
  for (const table of ['route_manifest_version', 'publication_projection']) {
    reject(`${table} extra receiving policy`, (doc) => {
      const relation = named(doc, 'relations', table).oid;
      doc.snapshot.catalog.policies?.push({
        oid: 900,
        name: 'unexpected_policy',
        relation,
        command: '*',
        permissive: true,
        roles: [0],
        using: 'true',
        check: 'true',
      });
    });
  }
  for (const role of ['', 'anon', 'authenticated', 'service_role']) {
    for (const table of [
      'route_manifest_version',
      'publication_projection',
      'route_manifest_version_version_no_seq',
    ]) {
      reject(`${role || 'PUBLIC'} grant on ${table}`, (doc) => {
        const object = named(doc, 'relations', table);
        const privilege = table.endsWith('_seq') ? 'U' : 'r';
        object.acl = [
          ...(object.acl as string[]),
          `${role}=${privilege}/postgres`,
        ];
      });
    }
    reject(`${role || 'PUBLIC'} direct guard execute`, (doc) => {
      const guard = named(doc, 'routines', 'route_manifest_version_guard');
      guard.acl = [...(guard.acl as string[]), `${role}=X/postgres`];
    });
  }
  reject('API column grant', (doc) => {
    find(
      doc,
      'columns',
      (c) => c.relation === 101 && c.name === 'render_payload',
    ).acl = ['anon=r/postgres'];
  });
  reject('implicit array type points to foreign row type', (doc) => {
    named(doc, 'types', '_route_manifest_version').elementType = 999;
  });
  reject('implicit row type exposes API privilege', (doc) => {
    named(doc, 'types', 'publication_projection').acl = ['anon=U/postgres'];
  });
  const columnMutations: Array<[string, string, unknown]> = [
    ['id', 'default', null],
    ['version_no', 'default', "nextval('wrong_sequence')"],
    ['version_no', 'identity', 'a'],
    ['activated_at', 'notNull', true],
    ['publication_set_hash', 'type', 'character varying(64)'],
  ];
  for (const [name, key, value] of columnMutations) {
    reject(`manifest column ${name}.${key}`, (doc) => {
      find(doc, 'columns', (c) => c.relation === 100 && c.name === name)[key] =
        value;
    });
  }
  reject('projection varchar bound changed', (doc) => {
    find(
      doc,
      'columns',
      (c) => c.relation === 101 && c.name === 'locale',
    ).type = 'character varying(8)';
  });
  for (const relation of [102, 300]) {
    reject(`missing legitimate sequence/index columns ${relation}`, (doc) => {
      doc.snapshot.catalog.columns =
        doc.snapshot.catalog.columns?.filter((c) => c.relation !== relation) ??
        [];
    });
  }
  for (const key of [
    'unique',
    'primary',
    'valid',
    'ready',
    'live',
    'immediate',
  ]) {
    reject(`primary index ${key} weakened`, (doc) => {
      find(doc, 'indexes', (i) => i.index === 300)[key] = false;
    });
  }
  reject('one-active partial index weakened', (doc) => {
    find(doc, 'indexes', (i) => i.index === 302).predicate = null;
  });
  reject('index definition weakened despite correct name', (doc) => {
    find(doc, 'indexes', (i) => i.index === 303).definition =
      'CREATE INDEX route_manifest_version_state_version_idx ON platform_private.route_manifest_version USING btree (state)';
  });
  for (const [key, value] of [
    ['minimum', '0'],
    ['maximum', '2147483647'],
    ['start', '2'],
    ['increment', '2'],
    ['cache', '2'],
    ['dataType', 'integer'],
  ]) {
    reject(`sequence ${key} changed`, (doc) => {
      named(doc, 'sequences', 'route_manifest_version_version_no_seq')[key] =
        value;
    });
  }
  reject('RI trigger disabled on old consumer relation', (doc) => {
    find(doc, 'triggers', (t) => t.internal && t.relation === 10).enabled = 'D';
  });
  reject('RI trigger cascades despite NO ACTION metadata', (doc) => {
    const trigger = find(doc, 'triggers', (t) =>
      String(t.definition).includes('RI_FKey_noaction_del'),
    );
    trigger.definition = String(trigger.definition).replace(
      'RI_FKey_noaction_del',
      'RI_FKey_cascade_del',
    );
  });
  reject('unexpected internal trigger on old publication relation', (doc) => {
    doc.snapshot.catalog.triggers?.push({
      ...find(doc, 'triggers', (t) => t.internal && t.relation === 11),
      oid: 999,
      name: 'unexpected_internal',
      constraint: 20,
    });
  });
  reject('extra unapproved receiving relation', (doc) => {
    doc.snapshot.catalog.relations?.push({
      ...named(doc, 'relations', 'route_manifest_version'),
      oid: 999,
      name: 'extra_receiver',
    });
  });
});

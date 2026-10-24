import { describe, expect } from 'vitest';

import {
  apiCase,
  change,
  clone,
  compositeFk,
  directFk,
  type Document,
  type Obj,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  afterPositive,
  before,
} from './phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures';

const row = (doc: Document, section: string, name: string): Obj => {
  const found = doc.snapshot.catalog[section]?.find((p) => p.name === name);
  if (!found) throw new Error(`missing unit row ${section}:${name}`);
  return found;
};

describe('DEC-197 source-only upgrade snapshot decisions (not DDL proof)', () => {
  apiCase(
    'DR-UR-R01 exact rollback equality ignores only observer PID',
    (api) => {
      const old = before();
      const after = clone(old);
      after.observer.backendPid = 202;
      expect(() => api.compareRollback({ before: old, after })).not.toThrow();
    },
  );
  const rollbackMutations: Array<[string, (d: Document) => void]> = [
    [
      'same observer session',
      (d) => {
        d.observer.backendPid = 201;
      },
    ],
    [
      'other database',
      (d) => {
        d.observer.database = 'foreign_database';
      },
    ],
    [
      'other observer user',
      (d) => {
        d.observer.user = 'anon';
      },
    ],
    [
      'unknown witness version',
      (d) => {
        d.witness = 'OTHER';
      },
    ],
    [
      'consumer image',
      (d) => {
        d.snapshot.consumerRows[0] += ' ';
      },
    ],
    [
      'lost consumer',
      (d) => {
        d.snapshot.consumerRows.pop();
      },
    ],
    [
      'lossless publication bigint',
      (d) => {
        d.snapshot.publicationVersionRows =
          d.snapshot.publicationVersionRows.map((p) =>
            p.replace('9007199254740993', '9007199254740992'),
          );
      },
    ],
    [
      'leaked receiving table',
      (d) => {
        d.snapshot.receivingObjects.manifestTable =
          'platform_private.route_manifest_version';
      },
    ],
  ];
  for (const section of Object.keys(before().snapshot.catalog)) {
    rollbackMutations.push([
      `catalog ${section}`,
      (d) => change(d, section, 'unexpected', true),
    ]);
  }
  for (const [name, mutate] of rollbackMutations) {
    apiCase(`DR-UR-R02 ${name} defeats rollback proof`, (api) => {
      const after = before('negative', 202);
      mutate(after);
      expect(() => api.compareRollback({ before: before(), after })).toThrow();
    });
  }
  apiCase(
    'DR-UR-R03 equal but already-migrated prestates cannot prove rollback',
    (api) => {
      const old = before();
      old.snapshot.receivingObjects.manifestTable = 'leaked';
      const after = clone(old);
      after.observer.backendPid = 202;
      expect(() => api.compareRollback({ before: old, after })).toThrow();
    },
  );
  apiCase(
    'DR-UR-C01 committed receiving catalog preserves old snapshot/security',
    (api) => {
      expect(() =>
        api.assertCommittedReceivingCatalog({
          before: before('positive'),
          after: afterPositive(),
        }),
      ).not.toThrow();
    },
  );
  const positiveMutations: Array<[string, (d: Document) => void]> = [
    [
      'same observer PID',
      (d) => {
        d.observer.backendPid = 201;
      },
    ],
    [
      'no COMMIT visibility',
      (d) => {
        d.snapshot = before('positive').snapshot;
      },
    ],
    [
      'manifest identity',
      (d) => {
        const c = d.snapshot.catalog.columns?.find(
          (p) => p.relation === 100 && p.name === 'version_no',
        );
        if (c) c.identity = '';
      },
    ],
    [
      'missing projection column',
      (d) => {
        d.snapshot.catalog.columns =
          d.snapshot.catalog.columns?.filter(
            (p) => p.name !== 'render_payload',
          ) ?? [];
      },
    ],
    [
      'unvalidated direct FK',
      (d) => {
        row(d, 'constraints', directFk).validated = false;
      },
    ],
    [
      'composite column order',
      (d) => {
        row(d, 'constraints', compositeFk).columns = [3, 2];
      },
    ],
    [
      'FK referenced order',
      (d) => {
        row(d, 'constraints', compositeFk).referencedColumns = [1, 2];
      },
    ],
    [
      'FK target',
      (d) => {
        row(d, 'constraints', compositeFk).referencedRelation = 11;
      },
    ],
    [
      'FK delete cascade',
      (d) => {
        row(d, 'constraints', directFk).deleteAction = 'c';
      },
    ],
    [
      'FK update cascade',
      (d) => {
        row(d, 'constraints', directFk).updateAction = 'c';
      },
    ],
    [
      'guard definer',
      (d) => {
        row(d, 'routines', 'route_manifest_version_guard').securityDefiner =
          true;
      },
    ],
    [
      'guard unsafe search path',
      (d) => {
        row(d, 'routines', 'route_manifest_version_guard').configuration = [
          'search_path=public',
        ];
      },
    ],
    [
      'guard PUBLIC execute',
      (d) => {
        row(d, 'routines', 'route_manifest_version_guard').acl = [
          '=X/postgres',
        ];
      },
    ],
    [
      'new runtime ACL',
      (d) => {
        row(d, 'relations', 'route_manifest_version').acl = ['anon=r/postgres'];
      },
    ],
    [
      'forced RLS',
      (d) => {
        row(d, 'relations', 'publication_projection').forceRowSecurity = false;
      },
    ],
    [
      'sequence cycle',
      (d) => {
        row(d, 'sequences', 'route_manifest_version_version_no_seq').cycle =
          true;
      },
    ],
    [
      'disabled new guard',
      (d) => {
        row(d, 'triggers', 'route_manifest_version_guard').enabled = 'D';
      },
    ],
  ];
  for (const key of Object.keys(afterPositive().snapshot.receivingObjects)) {
    positiveMutations.push([
      `absent ${key}`,
      (d) => {
        d.snapshot.receivingObjects[key] = null;
      },
    ]);
  }
  for (const section of Object.keys(before('positive').snapshot.catalog)) {
    positiveMutations.push([
      `old ${section} changed`,
      (d) => change(d, section, 'unexpected', true),
    ]);
  }
  for (const section of [
    'indexes',
    'constraints',
    'columns',
    'types',
    'sequences',
  ]) {
    positiveMutations.push([
      `missing new ${section}`,
      (d) => {
        d.snapshot.catalog[section] =
          before('positive').snapshot.catalog[section] ?? [];
      },
    ]);
  }
  for (const [name, mutate] of positiveMutations) {
    apiCase(`DR-UR-C02 ${name} rejects partial/unsafe upgrade`, (api) => {
      const after = afterPositive();
      mutate(after);
      expect(() =>
        api.assertCommittedReceivingCatalog({
          before: before('positive'),
          after,
        }),
      ).toThrow();
    });
  }
});

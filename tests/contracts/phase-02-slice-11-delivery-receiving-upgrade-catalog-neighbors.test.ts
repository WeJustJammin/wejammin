import { Buffer } from 'node:buffer';

import { describe, expect } from 'vitest';

import { relation } from './phase-02-slice-11-delivery-receiving-upgrade-catalog-fixtures';
import {
  apiCase,
  input,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import { expectPlanEqual } from './phase-02-slice-11-delivery-receiving-upgrade-plan-assertions';
import {
  afterPositive,
  before,
} from './phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures';
import type {
  Document,
  Obj,
  Plan,
} from './phase-02-slice-11-delivery-receiving-upgrade-types';

// 070 inventories whole schemas, not reserved name prefixes. These are unchanged
// legal neighbors, not actual DB captures or alternate receiving implementations.
type Neighbors = Record<string, Obj[]>;
const column = (
  parent: number,
  number: number,
  name: string,
  boolean = false,
): Obj => ({
  relation: parent,
  number,
  name,
  type: boolean ? 'boolean' : 'bigint',
  typeOid: boolean ? 16 : 20,
  notNull: true,
  identity: '',
  generated: '',
  collation: 0,
  acl: null,
  default: null,
});
const type = (
  schema: string,
  name: string,
  oid: number,
  parent = 0,
  element = 0,
): Obj => ({
  oid,
  schema,
  name,
  owner: 'postgres',
  acl: null,
  kind: parent ? 'c' : 'b',
  relation: parent,
  elementType: element,
  baseType: 0,
  notNull: false,
  default: null,
  collation: 0,
});
const namespace = (schema: string): Neighbors =>
  schema === 'public'
    ? {
        namespaces: [
          {
            oid: 650,
            name: 'public',
            owner: 'postgres',
            acl: ['postgres=UC/postgres', '=U/postgres'],
          },
        ],
      }
    : {};

function table(schema: string, name: string): Neighbors {
  return {
    ...namespace(schema),
    relations: [{ ...relation(600, name, 'r'), schema }],
    columns: [column(600, 1, 'version')],
    constraints: [
      {
        oid: 610,
        name: 'neighbor_version_check',
        type: 'c',
        relation: 600,
        referencedRelation: 0,
        columns: [1],
        referencedColumns: null,
        validated: true,
        deferrable: false,
        initiallyDeferred: false,
        updateAction: ' ',
        deleteAction: ' ',
        match: ' ',
        definition: 'CHECK ((version > 0))',
      },
    ],
    types: [
      type(schema, name, 620, 600),
      type(schema, `_${name}`, 621, 0, 620),
    ],
  };
}
function routine(schema: string, name: string): Neighbors {
  return {
    ...namespace(schema),
    routines: [
      {
        oid: 630,
        schema,
        name,
        identityArguments: '',
        owner: 'postgres',
        acl: ['postgres=X/postgres'],
        securityDefiner: false,
        configuration: ['search_path=""'],
        kind: 'f',
        volatility: 'v',
        strict: false,
        parallel: 'u',
        leakproof: false,
        definition: `CREATE OR REPLACE FUNCTION ${schema}.${name}()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nbegin\n  return new;\nend;\n$function$\n`,
      },
    ],
  };
}
function sequence(): Neighbors {
  const name = 'route_manifest_version_version_no_seq';
  return {
    ...namespace('public'),
    relations: [{ ...relation(600, name, 'S'), schema: 'public' }],
    columns: [
      column(600, 1, 'last_value'),
      column(600, 2, 'log_cnt'),
      column(600, 3, 'is_called', true),
    ],
    sequences: [
      {
        schema: 'public',
        name,
        owner: 'postgres',
        dataType: 'bigint',
        start: '1',
        minimum: '1',
        maximum: '9223372036854775807',
        increment: '1',
        cycle: false,
        cache: '1',
        lastValue: '9007199254740993',
      },
    ],
  };
}
function enumType(): Neighbors {
  return {
    ...namespace('public'),
    types: [
      { ...type('public', 'route_manifest_version', 620), kind: 'e' },
      type('public', '_route_manifest_version', 621, 0, 620),
    ],
  };
}
function sameConstraintName(): Neighbors {
  const result = table('platform_private', 'unrelated_archive');
  const constraint = result.constraints?.[0];
  if (!constraint) throw new Error('missing neighbor CHECK');
  constraint.name = 'publication_projection_version_check';
  return result;
}
function sameTriggerName(): Neighbors {
  const result = table('platform_private', 'unrelated_archive');
  result.routines =
    routine('platform_private', 'unrelated_guard').routines ?? [];
  result.triggers = [
    {
      oid: 640,
      name: 'route_manifest_version_guard',
      relation: 600,
      function: 630,
      enabled: 'O',
      internal: false,
      constraint: 0,
      definition:
        'CREATE TRIGGER route_manifest_version_guard BEFORE INSERT OR DELETE OR UPDATE ON platform_private.unrelated_archive FOR EACH ROW EXECUTE FUNCTION platform_private.unrelated_guard()',
    },
  ];
  return result;
}
function append(document: Document, neighbors: Neighbors): void {
  for (const [section, rows] of Object.entries(neighbors)) {
    document.snapshot.catalog[section]?.push(...structuredClone(rows));
  }
}
function positive(neighbors: Neighbors) {
  const old = before('positive');
  const after = afterPositive();
  append(old, neighbors);
  append(after, neighbors);
  return { before: old, after };
}

describe('DEC-197 catalog identity is schema/relation qualified', () => {
  const cases: Array<[string, () => Neighbors]> = [
    [
      'public.route_manifest_version table',
      () => table('public', 'route_manifest_version'),
    ],
    [
      'public.publication_projection table',
      () => table('public', 'publication_projection'),
    ],
    ['public receiving-name enum and implicit array', enumType],
    ['public receiving-name sequence', sequence],
    [
      'public receiving-name guard routine',
      () => routine('public', 'route_manifest_version_guard'),
    ],
    ['same CHECK name on unrelated relation OID', sameConstraintName],
    ['same trigger name on unrelated relation OID', sameTriggerName],
    [
      'platform_private.publication_projection_cache',
      () => table('platform_private', 'publication_projection_cache'),
    ],
  ];
  for (const [name, build] of cases) {
    apiCase(
      `DR-UR-N01 unchanged ${name} survives a committed upgrade`,
      (api) => {
        const neighbors = build();
        const pair = positive(neighbors);
        for (const [section, rows] of Object.entries(neighbors)) {
          for (const row of rows) {
            expect(pair.before.snapshot.catalog[section]).toContainEqual(row);
            expect(pair.after.snapshot.catalog[section]).toContainEqual(row);
          }
        }
        expect(() => api.assertCommittedReceivingCatalog(pair)).not.toThrow();
      },
    );
  }
  apiCase(
    'DR-UR-N02 unrelated private prefix neighbor survives exact rollback',
    (api) => {
      const old = before();
      append(old, table('platform_private', 'publication_projection_cache'));
      const after = structuredClone(old);
      after.observer.backendPid = 202;
      expect(after.snapshot).toEqual(old.snapshot);
      expect(() => api.compareRollback({ before: old, after })).not.toThrow();
    },
  );
  for (const changed of [
    'foreign-schema ACL',
    'unrelated trigger definition',
  ]) {
    apiCase(`DR-UR-N03 changed ${changed} is still refused`, (api) => {
      const pair = positive(
        changed === 'foreign-schema ACL'
          ? table('public', 'route_manifest_version')
          : sameTriggerName(),
      );
      const section =
        changed === 'foreign-schema ACL' ? 'relations' : 'triggers';
      const neighbor = pair.after.snapshot.catalog[section]?.find(
        (row) => row.oid === (section === 'relations' ? 600 : 640),
      );
      if (!neighbor) throw new Error('missing unchanged neighbor arrangement');
      if (section === 'relations') neighbor.acl = ['anon=r/postgres'];
      else neighbor.definition = 'changed historical trigger';
      expect(() => api.assertCommittedReceivingCatalog(pair)).toThrow();
    });
  }
});

describe('DEC-197 lossless plan fixture assertion', () => {
  apiCase(
    'DR-UR-B01 distinct complete byte copies compare without typed-array enumeration',
    (api) => {
      const expected = api.buildUpgradePlan(input());
      const actual: Plan = {
        ...expected,
        target: structuredClone(expected.target),
        source: {
          ...expected.source,
          bytes: Buffer.from(expected.source.bytes),
        },
        witness: Buffer.from(expected.witness),
        prefixManifest: {
          expectedPaths: [...expected.prefixManifest.expectedPaths],
          entries: expected.prefixManifest.entries.map((entry) => ({
            ...entry,
            bytes:
              entry.bytes === undefined ? undefined : Buffer.from(entry.bytes),
          })),
        },
      };
      expect(actual.witness).not.toBe(expected.witness);
      expect(() => expectPlanEqual(actual, expected)).not.toThrow();
    },
  );
  apiCase(
    'DR-UR-B02 unchanged hashes cannot conceal byte or metadata/key differences',
    (api) => {
      const expected = api.buildUpgradePlan(input());
      const flip = (bytes: Buffer): Buffer => {
        const value = Buffer.from(bytes);
        if (value.length === 0)
          throw new Error('empty byte-control arrangement');
        value[value.length - 1] = value[value.length - 1]! ^ 1;
        return value;
      };
      for (const mutate of [
        (plan: Plan) => {
          plan.source = { ...plan.source, bytes: flip(plan.source.bytes) };
        },
        (plan: Plan) => {
          plan.witness = flip(plan.witness);
        },
        ...[0, expected.prefixManifest.entries.length - 1].map(
          (index) => (plan: Plan) => {
            const entries = [...plan.prefixManifest.entries];
            const entry = entries[index];
            if (!entry?.bytes)
              throw new Error('missing prefix-byte arrangement');
            entries[index] = { ...entry, bytes: flip(entry.bytes) };
            plan.prefixManifest = { ...plan.prefixManifest, entries };
          },
        ),
        (plan: Plan) => {
          plan.runId = 'different-metadata';
        },
        (plan: Plan) => {
          Object.defineProperty(plan, 'unexpected', { value: true });
        },
        (plan: Plan) => {
          plan.source = {
            ...plan.source,
            unexpected: true,
          } as typeof plan.source;
        },
        (plan: Plan) => {
          Reflect.deleteProperty(plan, 'mode');
        },
      ]) {
        const actual = { ...expected };
        mutate(actual);
        expect(() => expectPlanEqual(actual, expected)).toThrow();
      }
    },
  );
});

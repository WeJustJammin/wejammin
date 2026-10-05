/** Every manifest entry's valid request, merged from the per-family modules. */
import { ADMIN_FIXTURES } from './claim-gate-fixtures-admin';
import { CMS_ACTOR_FIXTURES } from './claim-gate-fixtures-cms';
import {
  IDENTITY_FIXTURES,
  PUBLIC_FIXTURES,
} from './claim-gate-fixtures-identity';
import {
  PROFILE_CLAIM_FIXTURES,
  PROFILE_SUBJECT_FIXTURES,
} from './claim-gate-fixtures-profile';
import type { FixtureTable } from './claim-gate-fixtures-types';
import {
  RELEASE_PRINCIPAL_FIXTURES,
  WORKER_FIXTURES,
} from './claim-gate-fixtures-worker';

export type { GateFixture, Outcome } from './claim-gate-fixtures-types';

const tables: readonly FixtureTable[] = [
  ADMIN_FIXTURES,
  CMS_ACTOR_FIXTURES,
  IDENTITY_FIXTURES,
  PUBLIC_FIXTURES,
  PROFILE_CLAIM_FIXTURES,
  PROFILE_SUBJECT_FIXTURES,
  WORKER_FIXTURES,
  RELEASE_PRINCIPAL_FIXTURES,
];

export const CLAIM_GATE_FIXTURES: FixtureTable = Object.fromEntries(
  tables.flatMap((table) => Object.entries(table)),
);

/** Names defined by more than one table: always empty. */
export const duplicateFixtureNames = (): readonly string[] => {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const table of tables)
    for (const name of Object.keys(table)) {
      if (seen.has(name)) duplicates.push(name);
      seen.add(name);
    }
  return duplicates;
};

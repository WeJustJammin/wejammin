import type { Buffer } from 'node:buffer';

import type { AltTarget } from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

export type Obj = Record<string, unknown>;
export type Mode = 'negative' | 'positive';
export type Source = { path: string; bytes: Buffer; sha256: string };
export type PrefixEntry = {
  path: string;
  bytes: Buffer | undefined;
  sha256: string;
};
export type PlanInput = {
  repository: string;
  targetMigration: string;
  mode: Mode;
  runId: string;
  target: AltTarget;
  source: Source;
  witness: Buffer;
  prefixManifest: { expectedPaths: string[]; entries: PrefixEntry[] };
};
export type Plan = PlanInput & {
  applicationName: string;
  sourceSha256: string;
  witnessSha256: string;
  prefixSha256: string;
};
export type Invocation = { command: string; args: string[]; input: Buffer };
export type Execution = {
  status: number;
  stdout: string;
  stderr: string;
};
export type Document = {
  witness: string;
  observer: { database: string; backendPid: number; user: string };
  snapshot: {
    catalog: Record<string, Obj[]>;
    consumerRows: string[];
    publicationVersionRows: string[];
    receivingObjects: Obj;
  };
};
export type Api = {
  resolveMigrationSource(input: {
    repository: string;
    readOptional(path: string): Buffer | undefined;
  }): Source;
  buildUpgradePlan(input: PlanInput): Plan;
  buildPsqlInvocation(input: {
    target: AltTarget;
    applicationName: string;
    script: Buffer;
    mode: Mode;
  }): Invocation;
  classifyMigrationOutcome(input: Execution & { mode: Mode }): Obj;
  compareRollback(input: { before: Document; after: Document }): void;
  assertCommittedReceivingCatalog(input: {
    before: Document;
    after: Document;
  }): void;
  runReceivingUpgrade(input: {
    io: Record<string, unknown>;
    plan: Plan;
  }): Promise<Obj>;
};

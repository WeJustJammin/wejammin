import { laneRoleOfUser, type LaneRole } from './s09-lane-ids';

/**
 * Per-test in-memory world for the Slice 09 stateful browser lane. It holds
 * only what the Worker ports below persist; every record is created by a
 * producer port the browser reaches through the real routes, never seeded.
 */

export type DryRunRecord = {
  id: string;
  jobId: string;
  versionId: string;
  attemptId: string;
  planId: string;
  version: number;
  state: 'queued' | 'running' | 'completed';
  result: 'passed' | null;
  createdAt: string;
  updatedAt: string;
  sourceCount: number | null;
  targetCount: number | null;
  rowErrorCount: number | null;
  sourceHash: string | null;
  targetHash: string | null;
  reportHash: string | null;
};

export type JobRecord = {
  id: string;
  actor: LaneRole;
  dryRunId: string;
  reads: number;
  createdAt: string;
};

export type DecisionRecord = {
  id: string;
  reviewId: string;
  decision: 'approve' | 'reject';
  reviewer: LaneRole;
  decidedAt: string;
};

export type AssignmentRecord = {
  id: string;
  reviewId: string;
  reviewer: LaneRole;
  state: 'active' | 'revoked';
  startsAt: string;
  endsAt: string;
  version: number;
  reason: string | null;
};

export type ReviewRecord = {
  id: string;
  versionId: string;
  version: number;
  state: 'open' | 'approved' | 'rejected';
  submitter: LaneRole;
  submittedAt: string;
  decidedAt: string | null;
  approvalEvidenceHash: string | null;
  decisions: DecisionRecord[];
  assignments: AssignmentRecord[];
};

export type LocaleConfig = {
  sourceLocale: string;
  defaultLocale: string;
  supportedLocales: string[];
  fallbackChains: Record<string, string[]>;
};

export type VersionRecord = {
  id: string;
  typeId: string;
  artifactId: string;
  versionNo: number;
  /** Strong ETag numeric part; bumps on every state change. */
  rev: number;
  state: 'draft' | 'review' | 'approved' | 'active' | 'superseded';
  label: string;
  typeKey: string;
  locale: LocaleConfig;
  dryRunId: string | null;
  reviewId: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TypeRecord = { id: string; key: string; createdAt: string };

export type GrantRecord = {
  id: string;
  version: number;
  subjectPersonId: string;
  capability: string;
  validFrom: string;
  validThrough: string;
  state: 'active' | 'revoked';
  lastAction: 'granted' | 'renewed' | 'revoked';
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MfaFactorRecord = {
  id: string;
  providerFactorId: string;
  friendlyName: string;
  secret: string;
  state: 'pending' | 'verified';
  verifiedAt: string | null;
  lastUsedAt: string | null;
  pendingExpiresAt: string | null;
};

export type ChallengeRecord = {
  id: string;
  factorId: string;
  providerChallengeId: string;
  expiresAt: string;
  state: 'pending' | 'settled';
};

export type MfaAccount = {
  version: number;
  factors: MfaFactorRecord[];
  challenges: ChallengeRecord[];
  /** Failures charged to the shared 10-in-15-minutes budget. */
  failures: number;
};

export type World = {
  readonly testId: string;
  seq: number;
  stepUpAt: Partial<Record<LaneRole, string>>;
  mfa: Partial<Record<LaneRole, MfaAccount>>;
  types: TypeRecord[];
  versions: VersionRecord[];
  dryRuns: DryRunRecord[];
  jobs: JobRecord[];
  reviews: ReviewRecord[];
  grants: GrantRecord[];
  idem: Map<string, unknown>;
  mfaResets: { id: string; target: string; removed: number }[];
};

const worlds = new Map<string, World>();

export const worldFor = (testId: string): World => {
  const existing = worlds.get(testId);
  if (existing !== undefined) return existing;
  const created: World = {
    testId,
    seq: 0,
    stepUpAt: {},
    mfa: {},
    types: [],
    versions: [],
    dryRuns: [],
    jobs: [],
    reviews: [],
    grants: [],
    idem: new Map(),
    mfaResets: [],
  };
  worlds.set(testId, created);
  return created;
};

/** Identifier kinds keep one world's ids distinct per record family. */
export const ID_KIND = {
  type: 1,
  version: 2,
  artifact: 3,
  dryRun: 4,
  job: 5,
  attempt: 6,
  plan: 7,
  review: 8,
  decision: 9,
  assignment: 10,
  grant: 11,
  factor: 12,
  challenge: 13,
  provider: 14,
  reset: 15,
} as const;

/** `<seq>-<kind>-4000-8000-<testId><kind>`: the testId rides in every id. */
export const nextId = (world: World, kind: number): string => {
  world.seq += 1;
  const hex = (value: number, width: number): string =>
    value.toString(16).padStart(width, '0');
  return `${hex(world.seq, 8)}-${hex(kind, 4)}-4000-8000-${world.testId}${hex(kind, 4)}`;
};

/** Recover the world a job id belongs to (the job port has no session). */
export const worldForId = (id: string): World | null => {
  const match = /^[0-9a-f]{8}-[0-9a-f]{4}-4000-8000-([0-9a-f]{8})[0-9a-f]{4}$/u.exec(
    id,
  );
  return match === null ? null : (worlds.get(match[1] as string) ?? null);
};

export const iso = (ms: number): string => new Date(ms).toISOString();

export const worldAccount = (
  world: World,
  role: LaneRole,
): MfaAccount => {
  const existing = world.mfa[role];
  if (existing !== undefined) return existing;
  const created: MfaAccount = {
    version: 1,
    factors: [],
    challenges: [],
    failures: 0,
  };
  world.mfa[role] = created;
  return created;
};

export const roleOfSessionUser = laneRoleOfUser;

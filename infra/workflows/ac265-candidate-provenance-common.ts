import { TextDecoder } from 'node:util';

import { SafeReleaseTimestampSchema } from '../../packages/contracts/src/release-recovery-common.ts';
import { parseStrictJson } from './parse-strict-json.ts';

export const AC265_REPOSITORY = 'WeJustJammin/wejammin' as const;
export const AC265_CI_WORKFLOW_NAME = 'CI' as const;
export const AC265_CI_WORKFLOW_PATH = '.github/workflows/ci.yml' as const;
export const AC265_STAGING_WORKFLOW_NAME = 'Deploy staging' as const;
export const AC265_STAGING_WORKFLOW_PATH =
  '.github/workflows/deploy-staging.yml' as const;
export const AC265_CANDIDATE_ARTIFACT_NAME =
  'staging-verified-candidate' as const;
export const AC265_CI_ARTIFACT_DIRECTORY = 'ci-build' as const;
export const AC265_STAGING_ARTIFACT_DIRECTORY = 'candidate' as const;

const FAILURE = 'AC265 candidate provenance verification failed';
const MAX_GITHUB_RESPONSE_BYTES = 1024 * 1024;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export interface Ac265VerifiedRun {
  readonly runId: string;
  readonly runAttempt: string;
  readonly workflowId: number;
  readonly workflowPath: string;
  readonly sourceSha: string;
  readonly repositoryId: number;
  readonly actorLogin: string;
  readonly startedAt: number;
  readonly completedAt: number;
}

export interface Ac265VerifiedArtifact {
  readonly id: number;
  readonly name: string;
  readonly digest: string;
  readonly sizeInBytes: number;
  readonly createdAt: number;
}

export interface Ac265VerifiedDeployment {
  readonly id: string;
  readonly environment: 'staging';
  readonly webOrigin: string;
  readonly createdAt: number;
}

export interface Ac265GitHubProvenance {
  readonly ciRun: Ac265VerifiedRun;
  readonly stagingRun: Ac265VerifiedRun;
  readonly ciArtifact: Ac265VerifiedArtifact;
  readonly stagingArtifact: Ac265VerifiedArtifact;
  readonly deployment: Ac265VerifiedDeployment;
}

export interface Ac265VerifiedCandidateProvenance {
  readonly status: 'candidate_provenance_verified';
  readonly repository: typeof AC265_REPOSITORY;
  readonly sourceRevision: string;
  readonly ci: Readonly<{
    runId: string;
    runAttempt: string;
    workflowPath: typeof AC265_CI_WORKFLOW_PATH;
    artifactName: string;
    artifactId: number;
    artifactDigest: string;
  }>;
  readonly staging: Readonly<{
    runId: string;
    runAttempt: string;
    workflowPath: typeof AC265_STAGING_WORKFLOW_PATH;
    artifactName: typeof AC265_CANDIDATE_ARTIFACT_NAME;
    artifactId: number;
    artifactDigest: string;
    artifactBytes: number;
    deploymentId: string;
    deployedAt: string;
    environment: 'staging';
    webOrigin: string;
    apiOrigin: string;
  }>;
  readonly artifact: Readonly<{
    artifactDigest: string;
    axeReportSha256: string;
    buildId: string;
    migrationVersion: string;
  }>;
  readonly migration: Readonly<{
    projectRef: string;
    remoteHistorySha256: string;
    verifiedAt: string;
  }>;
  readonly provider: Readonly<{
    evidenceSha256: string;
    collectedAt: string;
    workers: readonly Readonly<{
      workerName: 'wejammin-api-staging' | 'wejammin-web-staging';
      versionId: string;
      deploymentId: string;
      versionCreatedAt: string;
      deploymentCreatedAt: string;
    }>[];
  }>;
}

export type Ac265Fetch = typeof fetch;

export const failAc265CandidateProvenance = (): never => {
  throw new Error(FAILURE);
};

export const isAc265Record = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const requireRecord = (value: unknown): Record<string, unknown> => {
  if (!isAc265Record(value)) return failAc265CandidateProvenance();
  return value;
};

export const safeOrigin = (value: unknown): string => {
  if (typeof value !== 'string') return failAc265CandidateProvenance();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return failAc265CandidateProvenance();
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.origin !== value ||
    !/^[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/u.test(parsed.hostname)
  )
    return failAc265CandidateProvenance();
  return parsed.origin;
};

export const timestampMs = (value: unknown): number => {
  const parsed = SafeReleaseTimestampSchema.safeParse(value);
  if (!parsed.success) return failAc265CandidateProvenance();
  const timestamp = Date.parse(parsed.data);
  if (!Number.isFinite(timestamp)) return failAc265CandidateProvenance();
  return timestamp;
};

export const requestAc265GitHubJson = async (
  path: string,
  token: string,
  fetchImpl: Ac265Fetch,
): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetchImpl(`https://api.github.com${path}`, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    return failAc265CandidateProvenance();
  }
  if (
    !response.ok ||
    response.redirected ||
    (response.url !== '' &&
      new URL(response.url).origin !== 'https://api.github.com') ||
    !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/iu.test(
      response.headers.get('content-type') ?? '',
    ) ||
    response.body === null
  )
    return failAc265CandidateProvenance();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_GITHUB_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return failAc265CandidateProvenance();
      }
      chunks.push(chunk.value);
    }
  } catch {
    return failAc265CandidateProvenance();
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    return parseStrictJson(text);
  } catch {
    return failAc265CandidateProvenance();
  }
};

export const isSha256PrefixedDigest = (value: unknown): value is string =>
  typeof value === 'string' && DIGEST_PATTERN.test(value);

export const fixedWorkflowRunPathMatches = (
  value: unknown,
  workflowPath: string,
): boolean =>
  value === workflowPath ||
  value === `${workflowPath}@main` ||
  value === `${workflowPath}@refs/heads/main`;

export const safeGitHubUrl = (
  value: unknown,
  expectedPath: string,
): boolean => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const schemeEnd = value.indexOf('://');
    if (
      schemeEnd < 0 ||
      value
        .slice(schemeEnd + 3)
        .split(/[/?#]/u, 1)[0]!
        .includes('@')
    )
      return false;
    return (
      url.protocol === 'https:' &&
      url.origin === 'https://api.github.com' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === expectedPath &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
};

export const parseJsonBytes = (bytes: Uint8Array): unknown => {
  let source: string;
  try {
    source = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    return failAc265CandidateProvenance();
  }
  try {
    return parseStrictJson(source);
  } catch {
    return failAc265CandidateProvenance();
  }
};

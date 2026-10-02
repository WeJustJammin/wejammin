import {
  AC265_REPOSITORY,
  AC265_STAGING_WORKFLOW_NAME,
  AC265_STAGING_WORKFLOW_PATH,
  failAc265CandidateProvenance,
  isAc265Record,
  isSha256PrefixedDigest,
  fixedWorkflowRunPathMatches,
  requestAc265GitHubJson,
  safeGitHubUrl,
  timestampMs,
  type Ac265Fetch,
} from './ac265-candidate-provenance-common.ts';
import {
  collectPages,
  repositoryApiPrefix,
  requireSafeInteger,
} from './ac265-candidate-provenance-github-api.ts';
import {
  deploymentJobUrl,
  selectAc265DeploymentStatus,
} from './ac265-candidate-provenance-github-deployment.ts';

export const REPORT_ARTIFACT_NAME = 'ac265-hosted-e2e-report-v3';

const RUN_ID_PATTERN = /^[1-9][0-9]{0,18}$/u;
const ATTEMPT_PATTERN = /^[1-9][0-9]{0,5}$/u;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const GITHUB_RUN_TIMESTAMP_SKEW_MS = 5 * 1000;
const ARTIFACT_ATTEMPT_SKEW_MS = 5 * 1000;
const MAX_REPORT_ARCHIVE_BYTES = 64 * 1024 * 1024;

export interface Ac265HostedVerificationRunProvenance {
  readonly repository: typeof AC265_REPOSITORY;
  readonly runId: string;
  readonly runAttempt: string;
  readonly workflowId: number;
  readonly sourceRevision: string;
  readonly deploymentId: string;
  readonly deploymentWebOrigin: string;
  readonly reportArtifactId: number;
  readonly reportArtifactName: string;
  /** GitHub-reported digest of the exact report archive bytes. */
  readonly reportArchiveDigest: string;
  /** GitHub-reported byte length of the exact report archive. */
  readonly reportArchiveBytes: number;
}

const requireOrigin = (value: unknown): string => {
  if (typeof value !== 'string') return failAc265CandidateProvenance();
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.origin !== value
    )
      return failAc265CandidateProvenance();
    return url.origin;
  } catch {
    return failAc265CandidateProvenance();
  }
};

const verifyStagingWorkflow = async (
  token: string,
  fetchImpl: Ac265Fetch,
): Promise<number> => {
  const file = AC265_STAGING_WORKFLOW_PATH.split('/').at(-1)!;
  const value = await requestAc265GitHubJson(
    repositoryApiPrefix() + '/actions/workflows/' + encodeURIComponent(file),
    token,
    fetchImpl,
  );
  if (
    !isAc265Record(value) ||
    value.name !== AC265_STAGING_WORKFLOW_NAME ||
    !fixedWorkflowRunPathMatches(value.path, AC265_STAGING_WORKFLOW_PATH) ||
    value.state !== 'active'
  )
    return failAc265CandidateProvenance();
  return requireSafeInteger(value.id);
};

const verifyCompletedRun = async (input: {
  readonly token: string;
  readonly fetchImpl: Ac265Fetch;
  readonly runId: string;
  readonly runAttempt: string;
  readonly workflowId: number;
}): Promise<{
  readonly sourceRevision: string;
  readonly repositoryId: number;
  readonly actorLogin: string;
  readonly startedAt: number;
  readonly completedAt: number;
}> => {
  const value = await requestAc265GitHubJson(
    repositoryApiPrefix() +
      '/actions/runs/' +
      input.runId +
      '/attempts/' +
      input.runAttempt,
    input.token,
    input.fetchImpl,
  );
  if (!isAc265Record(value)) return failAc265CandidateProvenance();
  const repository = isAc265Record(value.repository)
    ? value.repository
    : undefined;
  const headRepository = isAc265Record(value.head_repository)
    ? value.head_repository
    : undefined;
  const actorLogin = isAc265Record(value.actor) ? value.actor.login : undefined;
  const sourceRevision = value.head_sha;
  if (
    String(requireSafeInteger(value.id)) !== input.runId ||
    value.run_attempt !== Number(input.runAttempt) ||
    value.workflow_id !== input.workflowId ||
    value.name !== AC265_STAGING_WORKFLOW_NAME ||
    !fixedWorkflowRunPathMatches(value.path, AC265_STAGING_WORKFLOW_PATH) ||
    value.event !== 'workflow_run' ||
    value.status !== 'completed' ||
    value.conclusion !== 'success' ||
    value.head_branch !== 'main' ||
    typeof sourceRevision !== 'string' ||
    !SHA_PATTERN.test(sourceRevision) ||
    repository === undefined ||
    headRepository === undefined ||
    repository.full_name !== AC265_REPOSITORY ||
    headRepository.full_name !== AC265_REPOSITORY ||
    typeof actorLogin !== 'string' ||
    !/^[A-Za-z0-9-]{1,39}$/u.test(actorLogin)
  )
    return failAc265CandidateProvenance();
  const repositoryId = requireSafeInteger(repository.id);
  if (requireSafeInteger(headRepository.id) !== repositoryId)
    return failAc265CandidateProvenance();
  const createdAt = timestampMs(value.created_at);
  const startedAt = timestampMs(value.run_started_at);
  const completedAt = timestampMs(value.updated_at);
  if (
    createdAt - startedAt > GITHUB_RUN_TIMESTAMP_SKEW_MS ||
    startedAt > completedAt
  )
    return failAc265CandidateProvenance();
  return { sourceRevision, repositoryId, actorLogin, startedAt, completedAt };
};

const verifyReportArtifact = async (input: {
  readonly token: string;
  readonly fetchImpl: Ac265Fetch;
  readonly runId: string;
  readonly sourceRevision: string;
  readonly repositoryId: number;
  readonly attemptStartedAt: number;
  readonly attemptCompletedAt: number;
}): Promise<Readonly<{ id: number; digest: string; sizeInBytes: number }>> => {
  const values = await collectPages(
    repositoryApiPrefix() + '/actions/runs/' + input.runId + '/artifacts',
    input.token,
    input.fetchImpl,
  );
  // GitHub's run-artifact listing spans every attempt of the run, so filter to
  // the exact verified attempt window before requiring a unique match. A stale
  // prior-attempt artifact is excluded here and, if it were the only candidate,
  // leaves nothing to satisfy the gate.
  const windowStart = input.attemptStartedAt - ARTIFACT_ATTEMPT_SKEW_MS;
  const windowEnd = input.attemptCompletedAt + ARTIFACT_ATTEMPT_SKEW_MS;
  const matches = values.filter((value) => {
    if (!isAc265Record(value) || value.name !== REPORT_ARTIFACT_NAME)
      return false;
    try {
      const createdAt = timestampMs(value['created_at']);
      const updatedAt = timestampMs(value['updated_at']);
      return (
        createdAt >= windowStart &&
        createdAt <= windowEnd &&
        updatedAt >= createdAt &&
        updatedAt <= windowEnd
      );
    } catch {
      return false;
    }
  });
  if (matches.length !== 1) return failAc265CandidateProvenance();
  const artifact = matches[0]!;
  if (!isAc265Record(artifact) || !isAc265Record(artifact.workflow_run))
    return failAc265CandidateProvenance();
  const origin = artifact.workflow_run;
  const id = requireSafeInteger(artifact.id);
  const sizeInBytes = requireSafeInteger(artifact.size_in_bytes);
  if (
    artifact.expired !== false ||
    sizeInBytes > MAX_REPORT_ARCHIVE_BYTES ||
    !isSha256PrefixedDigest(artifact.digest) ||
    String(requireSafeInteger(origin.id)) !== input.runId ||
    requireSafeInteger(origin.repository_id) !== input.repositoryId ||
    requireSafeInteger(origin.head_repository_id) !== input.repositoryId ||
    origin.head_branch !== 'main' ||
    origin.head_sha !== input.sourceRevision
  )
    return failAc265CandidateProvenance();
  const encodedRepository = AC265_REPOSITORY.split('/')
    .map(encodeURIComponent)
    .join('/');
  if (
    !safeGitHubUrl(
      artifact.archive_download_url,
      '/repos/' + encodedRepository + '/actions/artifacts/' + id + '/zip',
    )
  )
    return failAc265CandidateProvenance();
  return { id, digest: artifact.digest, sizeInBytes };
};

const verifyStagingDeployment = async (input: {
  readonly token: string;
  readonly fetchImpl: Ac265Fetch;
  readonly runId: string;
  readonly sourceRevision: string;
  readonly actorLogin: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly webOrigin: string;
}): Promise<string> => {
  const query = new URLSearchParams({
    environment: 'staging',
    sha: input.sourceRevision,
    task: 'deploy',
  });
  const values = await collectPages(
    repositoryApiPrefix() + '/deployments?' + query.toString(),
    input.token,
    input.fetchImpl,
  );
  const candidates = values.filter((value) => {
    if (!isAc265Record(value)) return false;
    if (
      value.environment !== 'staging' ||
      value.production_environment !== false ||
      value.transient_environment !== false ||
      value.sha !== input.sourceRevision ||
      value.ref !== 'main' ||
      value.task !== 'deploy' ||
      !isAc265Record(value.creator) ||
      value.creator.login !== input.actorLogin
    )
      return false;
    const createdAt = timestampMs(value.created_at);
    return createdAt >= input.startedAt && createdAt <= input.completedAt;
  });
  if (candidates.length !== 1) return failAc265CandidateProvenance();
  const deployment = candidates[0] as Record<string, unknown>;
  const deploymentId = String(requireSafeInteger(deployment.id));
  const statuses = await collectPages(
    repositoryApiPrefix() + '/deployments/' + deploymentId + '/statuses',
    input.token,
    input.fetchImpl,
  );
  selectAc265DeploymentStatus(statuses, {
    actorLogin: input.actorLogin,
    webOrigin: input.webOrigin,
    jobUrlPattern: deploymentJobUrl(input.runId, AC265_REPOSITORY),
    windowStart: timestampMs(deployment.created_at),
    windowEnd: input.completedAt,
  });
  return deploymentId;
};

export const resolveAc265HostedVerificationRunProvenance = async (
  untrustedInput: unknown,
  fetchImpl: Ac265Fetch = fetch,
): Promise<Ac265HostedVerificationRunProvenance> => {
  if (!isAc265Record(untrustedInput)) return failAc265CandidateProvenance();
  if (
    Object.keys(untrustedInput).sort().join(',') !==
    ['attempt', 'repository', 'runId', 'stagingWebOrigin', 'token']
      .sort()
      .join(',')
  )
    return failAc265CandidateProvenance();
  const repository = untrustedInput['repository'];
  const token = untrustedInput['token'];
  const runId = untrustedInput['runId'];
  const attempt = untrustedInput['attempt'];
  if (
    repository !== AC265_REPOSITORY ||
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > 4096 ||
    /\s/u.test(token) ||
    typeof runId !== 'string' ||
    !RUN_ID_PATTERN.test(runId) ||
    !Number.isSafeInteger(Number(runId)) ||
    typeof attempt !== 'string' ||
    !ATTEMPT_PATTERN.test(attempt) ||
    Number(attempt) > 100000
  )
    return failAc265CandidateProvenance();
  const webOrigin = requireOrigin(untrustedInput['stagingWebOrigin']);
  const workflowId = await verifyStagingWorkflow(token, fetchImpl);
  const run = await verifyCompletedRun({
    token,
    fetchImpl,
    runId,
    runAttempt: attempt,
    workflowId,
  });
  const artifact = await verifyReportArtifact({
    token,
    fetchImpl,
    runId,
    sourceRevision: run.sourceRevision,
    repositoryId: run.repositoryId,
    attemptStartedAt: run.startedAt,
    attemptCompletedAt: run.completedAt,
  });
  const deploymentId = await verifyStagingDeployment({
    token,
    fetchImpl,
    runId,
    sourceRevision: run.sourceRevision,
    actorLogin: run.actorLogin,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    webOrigin,
  });
  return Object.freeze({
    repository: AC265_REPOSITORY,
    runId,
    runAttempt: attempt,
    workflowId,
    sourceRevision: run.sourceRevision,
    deploymentId,
    deploymentWebOrigin: webOrigin,
    reportArtifactId: artifact.id,
    reportArtifactName: REPORT_ARTIFACT_NAME,
    reportArchiveDigest: artifact.digest,
    reportArchiveBytes: artifact.sizeInBytes,
  });
};

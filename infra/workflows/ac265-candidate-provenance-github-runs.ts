import {
  AC265_CI_WORKFLOW_NAME,
  AC265_CI_WORKFLOW_PATH,
  AC265_STAGING_WORKFLOW_NAME,
  AC265_STAGING_WORKFLOW_PATH,
  type Ac265Fetch,
  type Ac265VerifiedArtifact,
  type Ac265VerifiedRun,
  failAc265CandidateProvenance,
  fixedWorkflowRunPathMatches,
  isAc265Record,
  isSha256PrefixedDigest,
  requestAc265GitHubJson,
  safeGitHubUrl,
  timestampMs,
} from './ac265-candidate-provenance-common.ts';
import type { Ac265CandidateProvenanceInputs } from './ac265-candidate-provenance-input.ts';
import {
  collectPages,
  repositoryApiPrefix,
  requireSafeInteger,
} from './ac265-candidate-provenance-github-api.ts';

const GITHUB_RUN_TIMESTAMP_SKEW_MS = 5 * 1000;

const verifyWorkflow = async (
  path: string,
  name: string,
  token: string,
  fetchImpl: Ac265Fetch,
): Promise<number> => {
  const file = path.split('/').at(-1);
  const value = await requestAc265GitHubJson(
    `${repositoryApiPrefix()}/actions/workflows/${encodeURIComponent(file!)}`,
    token,
    fetchImpl,
  );
  if (
    !isAc265Record(value) ||
    value.name !== name ||
    value.path !== path ||
    value.state !== 'active'
  )
    return failAc265CandidateProvenance();
  return requireSafeInteger(value.id);
};

const assertAttemptRun = (
  value: unknown,
  input: Ac265CandidateProvenanceInputs,
  expected: {
    readonly runId: string;
    readonly runAttempt: string;
    readonly workflowId: number;
    readonly workflowName: string;
    readonly workflowPath: string;
    readonly event: 'push' | 'workflow_run';
  },
): Ac265VerifiedRun => {
  if (!isAc265Record(value)) return failAc265CandidateProvenance();
  const repository = isAc265Record(value.repository)
    ? value.repository
    : undefined;
  const headRepository = isAc265Record(value.head_repository)
    ? value.head_repository
    : undefined;
  const runId = requireSafeInteger(value.id);
  const repositoryId = requireSafeInteger(repository?.id);
  const headRepositoryId = requireSafeInteger(headRepository?.id);
  const actorLogin = isAc265Record(value.actor) ? value.actor.login : undefined;
  const eventMatches =
    expected.event === 'push'
      ? value.event === 'push' || value.event === 'workflow_dispatch'
      : value.event === expected.event;
  if (
    String(runId) !== expected.runId ||
    value.run_attempt !== Number(expected.runAttempt) ||
    value.workflow_id !== expected.workflowId ||
    value.name !== expected.workflowName ||
    !fixedWorkflowRunPathMatches(value.path, expected.workflowPath) ||
    !eventMatches ||
    value.status !== 'completed' ||
    value.conclusion !== 'success' ||
    value.head_branch !== 'main' ||
    value.head_sha !== input.sourceSha ||
    repository?.full_name !== input.repository ||
    headRepository?.full_name !== input.repository ||
    repositoryId !== headRepositoryId ||
    typeof actorLogin !== 'string' ||
    !/^[A-Za-z0-9-]{1,39}$/u.test(actorLogin)
  )
    return failAc265CandidateProvenance();

  const createdAt = timestampMs(value.created_at);
  const startedAt = timestampMs(value.run_started_at);
  const completedAt = timestampMs(value.updated_at);
  if (
    createdAt - startedAt > GITHUB_RUN_TIMESTAMP_SKEW_MS ||
    startedAt > completedAt
  )
    return failAc265CandidateProvenance();
  return {
    runId: expected.runId,
    runAttempt: expected.runAttempt,
    workflowId: expected.workflowId,
    workflowPath: expected.workflowPath,
    sourceSha: input.sourceSha,
    repositoryId,
    actorLogin,
    startedAt,
    completedAt,
  };
};

const verifyRunAttempt = async (
  input: Ac265CandidateProvenanceInputs,
  fetchImpl: Ac265Fetch,
  expected: {
    readonly runId: string;
    readonly runAttempt: string;
    readonly workflowId: number;
    readonly workflowName: string;
    readonly workflowPath: string;
    readonly event: 'push' | 'workflow_run';
  },
): Promise<Ac265VerifiedRun> => {
  const value = await requestAc265GitHubJson(
    `${repositoryApiPrefix()}/actions/runs/${expected.runId}/attempts/${expected.runAttempt}`,
    input.token,
    fetchImpl,
  );
  return assertAttemptRun(value, input, expected);
};

const verifyArtifact = (
  value: unknown,
  expected: {
    readonly artifactName: string;
    readonly run: Ac265VerifiedRun;
    readonly repository: string;
  },
): Ac265VerifiedArtifact => {
  if (!isAc265Record(value)) return failAc265CandidateProvenance();
  const id = requireSafeInteger(value.id);
  const sizeInBytes = requireSafeInteger(value.size_in_bytes);
  const origin = isAc265Record(value.workflow_run)
    ? value.workflow_run
    : undefined;
  if (
    value.name !== expected.artifactName ||
    value.expired !== false ||
    sizeInBytes > 1024 * 1024 * 1024 ||
    !isSha256PrefixedDigest(value.digest) ||
    origin?.id !== Number(expected.run.runId) ||
    origin?.repository_id !== expected.run.repositoryId ||
    origin?.head_repository_id !== expected.run.repositoryId ||
    origin?.head_branch !== 'main' ||
    origin?.head_sha !== expected.run.sourceSha
  )
    return failAc265CandidateProvenance();

  const encodedRepository = expected.repository
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  if (
    !safeGitHubUrl(
      value.url,
      `/repos/${encodedRepository}/actions/artifacts/${id}`,
    ) ||
    !safeGitHubUrl(
      value.archive_download_url,
      `/repos/${encodedRepository}/actions/artifacts/${id}/zip`,
    )
  )
    return failAc265CandidateProvenance();
  const createdAt = timestampMs(value.created_at);
  if (
    createdAt < expected.run.startedAt ||
    createdAt > expected.run.completedAt
  )
    return failAc265CandidateProvenance();
  return {
    id,
    name: expected.artifactName,
    digest: value.digest,
    sizeInBytes,
    createdAt,
  };
};

const findArtifact = async (
  input: Ac265CandidateProvenanceInputs,
  run: Ac265VerifiedRun,
  artifactName: string,
  fetchImpl: Ac265Fetch,
): Promise<Ac265VerifiedArtifact> => {
  const path = `${repositoryApiPrefix()}/actions/runs/${run.runId}/artifacts`;
  const allArtifacts = await collectPages(path, input.token, fetchImpl);
  const matches = allArtifacts.filter(
    (artifact) => isAc265Record(artifact) && artifact.name === artifactName,
  );
  if (matches.length !== 1) return failAc265CandidateProvenance();
  return verifyArtifact(matches[0], {
    artifactName,
    run,
    repository: input.repository,
  });
};

export const verifyAc265GitHubRunAndArtifactsProvenance = async (
  input: Ac265CandidateProvenanceInputs,
  fetchImpl: Ac265Fetch,
): Promise<{
  readonly ciRun: Ac265VerifiedRun;
  readonly stagingRun: Ac265VerifiedRun;
  readonly ciArtifact: Ac265VerifiedArtifact;
  readonly stagingArtifact: Ac265VerifiedArtifact;
}> => {
  const [ciWorkflowId, stagingWorkflowId] = await Promise.all([
    verifyWorkflow(
      AC265_CI_WORKFLOW_PATH,
      AC265_CI_WORKFLOW_NAME,
      input.token,
      fetchImpl,
    ),
    verifyWorkflow(
      AC265_STAGING_WORKFLOW_PATH,
      AC265_STAGING_WORKFLOW_NAME,
      input.token,
      fetchImpl,
    ),
  ]);
  const [ciRun, stagingRun] = await Promise.all([
    verifyRunAttempt(input, fetchImpl, {
      runId: input.ciRunId,
      runAttempt: input.ciRunAttempt,
      workflowId: ciWorkflowId,
      workflowName: AC265_CI_WORKFLOW_NAME,
      workflowPath: AC265_CI_WORKFLOW_PATH,
      event: 'push',
    }),
    verifyRunAttempt(input, fetchImpl, {
      runId: input.stagingRunId,
      runAttempt: input.stagingRunAttempt,
      workflowId: stagingWorkflowId,
      workflowName: AC265_STAGING_WORKFLOW_NAME,
      workflowPath: AC265_STAGING_WORKFLOW_PATH,
      event: 'workflow_run',
    }),
  ]);
  if (ciRun.completedAt > stagingRun.startedAt)
    return failAc265CandidateProvenance();
  const [ciArtifact, stagingArtifact] = await Promise.all([
    findArtifact(input, ciRun, `workspace-build-${input.sourceSha}`, fetchImpl),
    findArtifact(input, stagingRun, 'staging-verified-candidate', fetchImpl),
  ]);
  return { ciRun, stagingRun, ciArtifact, stagingArtifact };
};

import {
  type Ac265Fetch,
  failAc265CandidateProvenance,
  isAc265Record,
} from './ac265-candidate-provenance-common.ts';
import { requireSafeInteger } from './ac265-candidate-provenance-github-api.ts';
import { verifyAc265GitHubRunAndArtifactsProvenance } from './ac265-candidate-provenance-github-runs.ts';
import {
  type Ac265CandidateProvenanceInputs,
  validateAc265CandidateProvenanceInputs,
} from './ac265-candidate-provenance-input.ts';

/**
 * Exact artifact identity for the two AC265 hosted E2E inputs. The workflow
 * resolves these IDs from the GitHub API before downloading anything and
 * passes them to the collector, so the collector can prove that the bytes it
 * verified are the bytes the job downloaded instead of trusting a later
 * name-based lookup.
 */
export interface Ac265HostedE2eArtifactIds {
  readonly ciArtifactId: number;
  readonly stagingArtifactId: number;
}

export interface Ac265HostedE2eResolvedArtifacts extends Ac265HostedE2eArtifactIds {
  readonly ciRunId: string;
  readonly stagingRunId: string;
}

const ARTIFACT_ID_PATTERN = /^[1-9][0-9]{0,18}$/u;

const requireDownloadedId = (
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): number => {
  const value = env[name];
  if (
    typeof value !== 'string' ||
    !ARTIFACT_ID_PATTERN.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    return failAc265CandidateProvenance();
  return Number(value);
};

/**
 * Reads the artifact IDs that the prepare action downloaded by, so the
 * collector binds the download to the verification instead of re-deriving it
 * from a name that could resolve to a different artifact.
 */
export const validateAc265HostedE2eDownloadedArtifactIds = (
  env: Readonly<Record<string, string | undefined>>,
): Ac265HostedE2eArtifactIds => {
  if (!isAc265Record(env)) return failAc265CandidateProvenance();
  return {
    ciArtifactId: requireDownloadedId(env, 'AC265_DOWNLOADED_CI_ARTIFACT_ID'),
    stagingArtifactId: requireDownloadedId(
      env,
      'AC265_DOWNLOADED_STAGING_ARTIFACT_ID',
    ),
  };
};

/**
 * Resolves the exact artifact IDs through the GitHub API alone. It reuses the
 * promoted run/attempt/workflow/deployment provenance verifier, which never
 * reads the local tree, so the prepare action may run it before downloading.
 */
export const resolveAc265HostedE2eArtifactIds = async (
  untrustedInputs: unknown,
  fetchImpl: Ac265Fetch = fetch,
): Promise<Ac265HostedE2eResolvedArtifacts> => {
  const inputs: Ac265CandidateProvenanceInputs =
    validateAc265CandidateProvenanceInputs(untrustedInputs);
  const trusted = await verifyAc265GitHubRunAndArtifactsProvenance(
    inputs,
    fetchImpl,
  );
  return {
    ciArtifactId: trusted.ciArtifact.id,
    stagingArtifactId: trusted.stagingArtifact.id,
    ciRunId: trusted.ciRun.runId,
    stagingRunId: trusted.stagingRun.runId,
  };
};

const requireArtifactIds = (value: unknown): Ac265HostedE2eArtifactIds => {
  if (!isAc265Record(value)) return failAc265CandidateProvenance();
  return {
    ciArtifactId: requireSafeInteger(value['ciArtifactId']),
    stagingArtifactId: requireSafeInteger(value['stagingArtifactId']),
  };
};

/**
 * Binds the download to the verification. Any difference between the artifact
 * IDs the workflow downloaded and the IDs the collector re-verified fails
 * closed before the collector writes anything, which closes the window a
 * re-upload or name reuse could otherwise open.
 */
export const assertAc265HostedE2eArtifactBinding = (
  downloaded: unknown,
  verified: unknown,
): void => {
  const expected = requireArtifactIds(downloaded);
  const actual = requireArtifactIds(verified);
  if (
    expected.ciArtifactId !== actual.ciArtifactId ||
    expected.stagingArtifactId !== actual.stagingArtifactId
  )
    return failAc265CandidateProvenance();
};

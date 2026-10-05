import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { sha256Ac265HostedSemanticSubject } from '../../infra/workflows/ac265-hosted-semantic-subject.ts';
import { createAc265HostedArtifactSourceManifest } from '../../infra/workflows/ac265-hosted-artifact-source-manifest.ts';
import type { Ac265HostedVerificationArchive } from '../../infra/workflows/ac265-hosted-verification-context-bundle.ts';
import {
  zipStoredEntries,
  writeArchive,
} from '../ac265-hosted-artifact-archive.test-support.ts';
import {
  AC265_TEST_RUNNER_MAPPING_KEY_ID,
  AC265_TEST_RUNNER_MAPPING_PUBLIC_KEY_PEM,
  AC265_TEST_RUNNER_MAPPING_TRUSTED_KEYS,
  DEFAULT_HOSTED_ARTIFACT_ATTESTATION_WINDOWS,
  hostedArtifactSourcesFor,
} from './ac265-hosted-artifact-resolver-fixtures.ts';
import {
  AC265_TEST_OUTAGE_TARGET_KEY_ID,
  AC265_TEST_OUTAGE_TARGET_PUBLIC_KEY_PEM,
  AC265_TEST_OUTAGE_TARGET_TRUSTED_KEYS,
  contextFor,
  setApprovedOutageTargetSource,
  setApprovedRunnerMappingSource,
} from './ac265-hosted-receipt-context-fixtures.ts';
import { createFixture as createHostedFixture } from './ac265-hosted-receipt-test-fixtures.ts';
import {
  jsonBytes,
  makeContract,
  sha256,
} from './ac265-hosted-test-fixtures.ts';

export const AC265_HOSTED_VERIFICATION_BUNDLE_SCHEMA =
  'ac265-hosted-verification-context-v1';
export const REPOSITORY = 'WeJustJammin/wejammin' as const;

const AUTHORITY_ID = 'ac265-source-authority-v1';
const AUTHORITY_KEY_ID = 'ac265-source-manifest-v1';
const MANIFEST_REF =
  'ac265-artifact-manifest://staging/70000000-0000-4000-8000-000000000010';
const AUTHORIZATION_REF =
  'ac265-authorization://staging/70000000-0000-4000-8000-000000000011';
export const TRUSTED_CUTOFF_AT = '2026-09-03T12:00:00.000Z';
const MANIFEST_ISSUED_AT = '2026-09-03T10:35:00.000Z';
const MANIFEST_EXPIRES_AT = '2026-09-03T10:40:00.000Z';

const authorityKeyPair = generateKeyPairSync('ed25519');
export const AUTHORITY_PRIVATE_KEY_PEM = authorityKeyPair.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();
export const AUTHORITY_PUBLIC_KEY_PEM = authorityKeyPair.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

const base64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');

const mappingPayloadFor = (contract: ReturnType<typeof makeContract>) => ({
  schemaVersion: 'ac265-approved-runner-mappings-v1',
  source: 'protected-ac265-runner-mapping-control-plane',
  mappingId: '60000000-0000-4000-8000-000000000001',
  approvedAt: '2026-09-03T10:29:00.000Z',
  runId: contract.runId,
  identity: contract.identity,
  roleResourceBindings: contract.roleResourceBindings,
  scenarioRoleBindings: contract.scenarioRoleBindings,
});

const outageTargetPayloadFor = (contract: ReturnType<typeof makeContract>) => ({
  schemaVersion: 'ac265-approved-outage-target-v1',
  source: 'protected-staging-fault-control-plane',
  targetId: '30000000-0000-4000-8000-000000000001',
  targetRef:
    'ac265-outage-target://staging/30000000-0000-4000-8000-000000000001',
  approvedAt: '2026-09-03T10:29:00.000Z',
  expiresAt: '2026-09-03T10:35:00.000Z',
  scope: {
    runId: contract.runId,
    hostingProjectId: contract.identity.hostingProjectId,
    supabaseProjectRef: contract.identity.supabaseProjectRef,
    deploymentId: contract.identity.deploymentId,
    dependencyId: contract.scenarioParameters.dependencyOutage.dependencyId,
    route: contract.scenarioParameters.dependencyOutage.route,
  },
});

export type StagingScopeTamper =
  | 'none'
  | 'manifest-digest'
  | 'archive-digest'
  | 'manifest-signature'
  | 'subject-digest';

export const createStagingScopeFixture = (
  options: {
    readonly tamper?: StagingScopeTamper;
    /**
     * Overrides the generated runner contract. The CLI route authenticates the
     * run, attempt, revision, and deployment against the GitHub API before it
     * verifies the report, so a genuine end-to-end fixture needs a contract
     * identity that matches the API it is resolved against.
     */
    readonly contract?: ContentSchemaRegistryHostedRunnerContract;
  } = {},
) => {
  const tamper = options.tamper ?? 'none';
  const contract = options.contract ?? makeContract();
  const contractBytes = jsonBytes(contract);
  const hosted = createHostedFixture({
    contract,
    includeCandidateIdentityReceipt: true,
    includeExecutionBindings: true,
    receiptIssuedAt: '2026-09-03T11:00:00.000Z',
  });
  const context = contextFor(hosted, contract);
  setApprovedRunnerMappingSource(context, mappingPayloadFor(contract));
  setApprovedOutageTargetSource(context, outageTargetPayloadFor(contract));

  const sources = hostedArtifactSourcesFor(
    hosted,
    contract,
    contractBytes,
    DEFAULT_HOSTED_ARTIFACT_ATTESTATION_WINDOWS,
  );
  const candidateIdentitySha256 = sha256(jsonBytes(contract.identity));
  const runnerContractSha256 = sha256(contractBytes);

  const members = sources.map((source, index) => ({
    ref: source.expectation.ref,
    artifactMember: `sources/${index}-artifact.bin`,
    attestationMember: `sources/${index}-attestation.bin`,
    artifactBytes: Buffer.from(source.artifactBytes),
    attestationBytes: Buffer.from(source.attestationBytes),
    subjectSha256:
      tamper === 'subject-digest' && index === 0
        ? 'f'.repeat(64)
        : source.expectation.subjectSha256,
    keyId: source.expectation.keyId,
    kind: source.expectation.kind,
    artifactSha256: sha256(source.artifactBytes),
    attestationSha256: sha256(source.attestationBytes),
  }));

  const sortedMembers = [...members].sort((left, right) =>
    left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0,
  );

  const manifestAuthorityKeyId =
    tamper === 'manifest-signature' ? 'ac265-other-key-v1' : AUTHORITY_KEY_ID;
  const manifest = createAc265HostedArtifactSourceManifest({
    manifest: {
      schemaVersion: 'ac265-hosted-artifact-source-manifest-v1',
      domain: 'WEJAMMIN-AC265-HOSTED-ARTIFACT-SOURCE-MANIFEST-V1',
      algorithm: 'Ed25519',
      criterion: 'P2-S09-AC-265',
      environment: 'staging',
      source: 'protected-upstream-artifact-authority',
      authorityId: AUTHORITY_ID,
      authorityKeyId: AUTHORITY_KEY_ID,
      manifestRef: MANIFEST_REF,
      authorizationRef: AUTHORIZATION_REF,
      runId: contract.runId,
      candidateIdentitySha256,
      sourceRevision: contract.identity.sourceRevision,
      deploymentId: contract.identity.deploymentId,
      runnerContractSha256,
      sources: sortedMembers.map((member) => ({
        kind: member.kind,
        artifactRef: member.ref,
        artifactSha256: member.artifactSha256,
        attestationSha256: member.attestationSha256,
        attestationKeyId: member.keyId,
        subjectSha256: member.subjectSha256,
      })),
      issuedAt: MANIFEST_ISSUED_AT,
      expiresAt: MANIFEST_EXPIRES_AT,
    },
    privateKeyPem: AUTHORITY_PRIVATE_KEY_PEM,
  });
  const manifestBytes = manifest.manifestBytes;

  const archivePath = writeArchive(
    members.flatMap((member) => [
      { name: member.artifactMember, bytes: member.artifactBytes },
      { name: member.attestationMember, bytes: member.attestationBytes },
    ]),
    'ac265-sources.zip',
  ).archivePath;
  const archiveBytes = readFileSync(archivePath);

  const archives: readonly Ac265HostedVerificationArchive[] = [
    {
      path: archivePath,
      expectedBytes: archiveBytes.byteLength,
      expectedSha256:
        tamper === 'archive-digest' ? 'a'.repeat(64) : sha256(archiveBytes),
      allowedMembers: members.flatMap((member) => [
        member.artifactMember,
        member.attestationMember,
      ]),
      requiredMembers: [],
      sources: members.map((member) => ({
        ref: member.ref,
        artifactMember: member.artifactMember,
        attestationMember: member.attestationMember,
      })),
    },
  ];

  const reportBytes = jsonBytes(hosted.report);
  const reportArchive = writeArchive(
    [{ name: 'report-v3.json', bytes: Buffer.from(reportBytes) }],
    'ac265-report.zip',
  );
  const reportArchiveBytes = readFileSync(reportArchive.archivePath);
  const bundle = {
    schemaVersion: AC265_HOSTED_VERIFICATION_BUNDLE_SCHEMA,
    repository: REPOSITORY,
    runnerContractBase64: base64(contractBytes),
    trustedCutoffAt: TRUSTED_CUTOFF_AT,
    maxRunDurationMs: 30 * 60 * 1000,
    approvedRunnerMappingsBase64: base64(context.approvedRunnerMappingsBytes!),
    approvedRunnerMappingAttestationBase64: base64(
      context.approvedRunnerMappingAttestationBytes!,
    ),
    approvedRunnerMappingTrustedKeys: AC265_TEST_RUNNER_MAPPING_TRUSTED_KEYS,
    approvedOutageTargetBase64: base64(context.approvedOutageTargetBytes!),
    approvedOutageTargetAttestationBase64: base64(
      context.approvedOutageTargetAttestationBytes!,
    ),
    approvedOutageTargetTrustedKeys: AC265_TEST_OUTAGE_TARGET_TRUSTED_KEYS,
    sourceManifestBase64: base64(manifestBytes),
    sourceManifestExpected: {
      authorityId: AUTHORITY_ID,
      authorityKeyId: manifestAuthorityKeyId,
      manifestRef: MANIFEST_REF,
      manifestSha256:
        tamper === 'manifest-digest' ? 'b'.repeat(64) : sha256(manifestBytes),
      authorizationRef: AUTHORIZATION_REF,
      authorization: {
        authorizedAt: MANIFEST_ISSUED_AT,
        expiresAt: MANIFEST_EXPIRES_AT,
      },
      runId: contract.runId,
      candidateIdentitySha256,
      sourceRevision: contract.identity.sourceRevision,
      deploymentId: contract.identity.deploymentId,
      runnerContractSha256,
    },
    sourceManifestTrustedKeys: [
      {
        authorityId: AUTHORITY_ID,
        keyId: AUTHORITY_KEY_ID,
        publicKeyPem: AUTHORITY_PUBLIC_KEY_PEM,
        validFrom: '2026-09-01T00:00:00.000Z',
        validUntil: '2026-10-01T00:00:00.000Z',
        status: 'active',
      },
    ],
    artifactTrustedKeys: AC265_TEST_RUNNER_MAPPING_TRUSTED_KEYS,
    reportArchiveMember: 'report-v3.json',
    reportBodySha256: sha256(reportBytes),
    archives,
  };

  return {
    contract,
    contractBytes,
    hosted,
    context,
    sources,
    members,
    archives,
    manifest,
    manifestBytes,
    archivePath,
    reportBytes,
    reportArchivePath: reportArchive.archivePath,
    reportArchiveBytes: reportArchiveBytes.byteLength,
    reportArchiveSha256: sha256(reportArchiveBytes),
    reportBodySha256: sha256(reportBytes),
    reportSha256: sha256(reportBytes),
    bundle,
    bundleBytes: jsonBytes(bundle),
    runnerMappingTrustedKeys: AC265_TEST_RUNNER_MAPPING_TRUSTED_KEYS,
    outageTargetTrustedKeys: AC265_TEST_OUTAGE_TARGET_TRUSTED_KEYS,
    runnerMappingKeyId: AC265_TEST_RUNNER_MAPPING_KEY_ID,
    runnerMappingPublicKeyPem: AC265_TEST_RUNNER_MAPPING_PUBLIC_KEY_PEM,
    outageTargetKeyId: AC265_TEST_OUTAGE_TARGET_KEY_ID,
    outageTargetPublicKeyPem: AC265_TEST_OUTAGE_TARGET_PUBLIC_KEY_PEM,
    attestationWindows: DEFAULT_HOSTED_ARTIFACT_ATTESTATION_WINDOWS,
    semanticSubjectSha256: sha256Ac265HostedSemanticSubject,
  };
};

export const bundleWithOverrides = (
  fixture: ReturnType<typeof createStagingScopeFixture>,
  overrides: Readonly<Record<string, unknown>>,
): Uint8Array => jsonBytes({ ...fixture.bundle, ...overrides });

export const utf8Bytes = (value: string): Uint8Array =>
  Buffer.from(value, 'utf8');

export const sha256Of = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

export { zipStoredEntries };

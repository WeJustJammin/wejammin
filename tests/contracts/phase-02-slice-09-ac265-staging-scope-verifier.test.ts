import { readFileSync } from 'node:fs';

import { afterAll, describe, expect, it } from 'vitest';

import {
  cleanupArchiveFixtures,
  writeArchive,
} from '../ac265-hosted-artifact-archive.test-support.ts';
import {
  AC265_HOSTED_SCOPE_FAILURE,
  buildAc265HostedVerificationContext,
  verifyAc265HostedStagingEvidence,
} from '../../infra/workflows/content-schema-registry-hosted-staging-scope-verifier.ts';
import type { ContentSchemaRegistryHostedRunnerContract } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-input.ts';
import {
  bundleWithOverrides,
  createStagingScopeFixture,
  sha256Of,
  type StagingScopeTamper,
} from './ac265-staging-scope-verifier-test-support.ts';

afterAll(() => {
  cleanupArchiveFixtures();
});

const PROTECTED_SIDECAR_FILES = [
  'packages/contracts/src/content-schema-registry/operational-release-evidence.ts',
  'packages/contracts/src/content-schema-registry/operational-release-evidence-browser.ts',
  'infra/workflows/verify-content-schema-registry-release-evidence.ts',
  'infra/workflows/content-schema-registry-retained-report-verifier.ts',
  'infra/workflows/content-schema-registry-retained-hosted-report-verifier.ts',
] as const;

const identityFor = (
  fixture: ReturnType<typeof createStagingScopeFixture>,
) => ({
  reportArchivePath: fixture.reportArchivePath,
  authenticatedReportArchiveSha256: fixture.reportArchiveSha256,
  authenticatedReportArchiveBytes: fixture.reportArchiveBytes,
  authenticatedStagingRunId: fixture.contract.identity.stagingRunId,
  authenticatedStagingRunAttempt: fixture.contract.identity.stagingRunAttempt,
  authenticatedSourceRevision: fixture.contract.identity.sourceRevision,
  authenticatedDeploymentId: fixture.contract.identity.deploymentId,
});

describe('AC265 hosted staging-scope verification route', () => {
  it('leaves the four-part production sidecar untouched', () => {
    for (const relativePath of PROTECTED_SIDECAR_FILES) {
      const contents = readFileSync(relativePath, 'utf8');
      expect(contents).not.toContain('ac265-hosted-verification-context-v1');
      expect(contents).not.toContain('authenticatedReportSha256');
      expect(contents).not.toContain('ac265-hosted-verification-bundle-errors');
    }
  });

  it('verifies a genuine staging-scope report without the release sidecar', () => {
    const fixture = createStagingScopeFixture();
    const manifest = verifyAc265HostedStagingEvidence({
      bundleBytes: fixture.bundleBytes,
      reportBytes: fixture.reportBytes,
      ...identityFor(fixture),
    });
    expect(manifest.criterion).toBe('P2-S09-AC-265');
    expect(manifest.status).toBe('verified');
    expect(manifest.scope).toBe('staging');
    expect(manifest.environment).toBe('staging');
    expect(manifest.deploymentId).toBe(fixture.contract.identity.deploymentId);
    expect(manifest.sourceRevision).toBe(
      fixture.contract.identity.sourceRevision,
    );
    expect(manifest.runId).toBe(fixture.contract.runId);
    expect(manifest.roles).toHaveLength(9);
    expect(manifest.scenarios).toHaveLength(10);
    expect(manifest.reportSha256).toBe(fixture.reportSha256);
    expect(manifest.trustedCutoffAt).toBe('2026-09-03T12:00:00.000Z');
  });

  it('binds the manifest to the report and contract bytes it verified', () => {
    const fixture = createStagingScopeFixture();
    const manifest = verifyAc265HostedStagingEvidence({
      bundleBytes: fixture.bundleBytes,
      reportBytes: fixture.reportBytes,
      ...identityFor(fixture),
    });
    expect(manifest.reportSha256).toBe(sha256Of(fixture.reportBytes));
    expect(manifest.reportArchiveSha256).toBe(fixture.reportArchiveSha256);
    expect(manifest.reportSha256).not.toBe(manifest.reportArchiveSha256);
    expect(manifest.runnerContractSha256).toBe(sha256Of(fixture.contractBytes));
  });

  it.each<[string, Record<string, unknown>]>([
    ['an absent protected context bundle', { bundleBytes: undefined }],
    ['an absent report archive path', { reportArchivePath: undefined }],
    [
      'a report archive digest that does not match the artifact API',
      { authenticatedReportArchiveSha256: 'a'.repeat(64) },
    ],
    [
      'a report archive length that does not match the artifact API',
      { authenticatedReportArchiveBytes: 1 },
    ],
    [
      'a report body digest that does not match the pinned producer digest',
      { bundleBytes: 'will-be-replaced' },
    ],
    [
      'a source revision that does not match the run',
      { authenticatedSourceRevision: 'b'.repeat(40) },
    ],
    [
      'a staging run ID that does not match the authenticated run',
      { authenticatedStagingRunId: '34751910126' },
    ],
    [
      'a staging run attempt that does not match the authenticated attempt',
      { authenticatedStagingRunAttempt: 2 },
    ],
    [
      'an absent authenticated staging run ID',
      { authenticatedStagingRunId: undefined },
    ],
    [
      'an absent authenticated staging run attempt',
      { authenticatedStagingRunAttempt: undefined },
    ],
    [
      'a deployment identity that does not match the run',
      { authenticatedDeploymentId: '999999999999' },
    ],
  ])('fails closed on %s', (_label, override) => {
    const fixture = createStagingScopeFixture();
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: fixture.bundleBytes,
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
        ...override,
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it.each<[StagingScopeTamper, string]>([
    ['manifest-digest', 'a source-manifest digest mismatch'],
    ['archive-digest', 'an artifact archive digest mismatch'],
    ['manifest-signature', 'a source manifest signed by an untrusted key'],
    ['subject-digest', 'a source subject digest that does not match'],
  ])('fails closed on %s (%s)', (tamper) => {
    const fixture = createStagingScopeFixture({ tamper });
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: fixture.bundleBytes,
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('fails closed when the trusted runner mapping attestation is absent', () => {
    const fixture = createStagingScopeFixture();
    const bundle = { ...fixture.bundle } as Record<string, unknown>;
    delete bundle['approvedRunnerMappingAttestationBase64'];
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: Buffer.from(JSON.stringify(bundle), 'utf8'),
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects a non-staging identity carried by a caller-supplied bundle', () => {
    const fixture = createStagingScopeFixture();
    const contract = {
      ...fixture.contract,
      identity: { ...fixture.contract.identity, environment: 'production' },
    } as unknown as ContentSchemaRegistryHostedRunnerContract;
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: bundleWithOverrides(fixture, {
          runnerContractBase64: Buffer.from(JSON.stringify(contract)).toString(
            'base64',
          ),
        }),
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects a future trusted cutoff', () => {
    const fixture = createStagingScopeFixture();
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: bundleWithOverrides(fixture, {
          trustedCutoffAt: '2099-01-01T00:00:00.000Z',
        }),
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects a private key smuggled into a trusted key list', () => {
    const fixture = createStagingScopeFixture();
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: bundleWithOverrides(fixture, {
          approvedRunnerMappingTrustedKeys: [
            {
              ...fixture.runnerMappingTrustedKeys[0],
              publicKeyPem:
                '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
            },
          ],
        }),
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects duplicate JSON members in the bundle envelope', () => {
    const fixture = createStagingScopeFixture();
    const text = Buffer.from(fixture.bundleBytes).toString('utf8');
    const duplicated = text.replace(
      '"schemaVersion":"ac265-hosted-verification-context-v1"',
      '"schemaVersion":"ac265-hosted-verification-context-v1","schemaVersion":"ac265-hosted-verification-context-v1"',
    );
    expect(duplicated).not.toBe(text);
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: Buffer.from(duplicated, 'utf8'),
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects unknown bundle members instead of ignoring them', () => {
    const fixture = createStagingScopeFixture();
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: bundleWithOverrides(fixture, { accepted: true }),
        reportBytes: fixture.reportBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects a valid JSON context bundle when its raw bytes exceed the bound', () => {
    const fixture = createStagingScopeFixture();
    const oversizedBundleBytes = Buffer.concat([
      Buffer.from(fixture.bundleBytes),
      Buffer.alloc(256 * 1024, 0x20),
    ]);
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: oversizedBundleBytes,
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects an archive whose bytes were altered after download', () => {
    const fixture = createStagingScopeFixture();
    const tamperedArchive = writeArchive(
      [
        {
          name: 'report-v3.json',
          bytes: Buffer.concat([
            Buffer.from(fixture.reportBytes),
            Buffer.from(' '),
          ]),
        },
      ],
      'tampered-report.zip',
    );
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: fixture.bundleBytes,
        ...identityFor(fixture),
        reportArchivePath: tamperedArchive.archivePath,
        authenticatedReportArchiveSha256: fixture.reportArchiveSha256,
        authenticatedReportArchiveBytes: fixture.reportArchiveBytes,
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('rejects a report body that does not match the pinned producer digest', () => {
    const fixture = createStagingScopeFixture();
    expect(() =>
      verifyAc265HostedStagingEvidence({
        bundleBytes: bundleWithOverrides(fixture, {
          reportBodySha256: 'c'.repeat(64),
        }),
        ...identityFor(fixture),
      }),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });

  it('exposes a context builder that rejects untrusted input', () => {
    expect(() => buildAc265HostedVerificationContext(undefined)).toThrow(
      AC265_HOSTED_SCOPE_FAILURE,
    );
    expect(() =>
      buildAc265HostedVerificationContext(Buffer.from('{}', 'utf8')),
    ).toThrow(AC265_HOSTED_SCOPE_FAILURE);
  });
});

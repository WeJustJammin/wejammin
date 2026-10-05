import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  statSync,
  type Stats,
} from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type {
  ContentSchemaRegistryOperationalReleaseEvidence,
  OperationalReleaseEvidenceExpectedIdentity,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence.ts';
import {
  CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH,
  parseContentSchemaRegistryAutomatedAxeDigestSidecar,
  validateContentSchemaRegistryAutomatedAxeReportBytes,
} from './content-schema-registry-axe-report-verifier.ts';
import { validateContentSchemaRegistryManualAccessibilityReportBytes } from './content-schema-registry-manual-accessibility-report-verifier.ts';
import {
  validateAndBindRetainedHostedE2eReportV3,
  type RetainedHostedE2eVerificationInput,
} from './content-schema-registry-retained-hosted-report-verifier.ts';

const MAX_RETAINED_REPORT_BYTES = 10 * 1024 * 1024;

type RetainedReportReference = Readonly<{ path: string; sha256: string }>;

const retainedReports = (
  evidence: ContentSchemaRegistryOperationalReleaseEvidence,
): readonly (readonly [string, RetainedReportReference])[] => [
  ['alert configuration', evidence.alerting.configurationReport],
  ['alert delivery receipt', evidence.alerting.deliveryReceipt.report],
  ['SLO measurement', evidence.slo.measurementReport],
  ['SLO dataset', evidence.slo.datasetReport],
  ['hosted E2E', evidence.hostedE2e.report],
  ['automated accessibility', evidence.accessibility.automatedReport],
  ['VoiceOver accessibility', evidence.accessibility.manualRuns[0].report],
  ['NVDA accessibility', evidence.accessibility.manualRuns[1].report],
];

const sha256Bytes = (value: Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

export const verifyReportTree = (
  approvedRoot: string,
  allowedPaths: ReadonlySet<string>,
): void => {
  const allowedDirectories = new Set(
    [...allowedPaths].flatMap((allowedPath) => {
      const segments = allowedPath.split('/');
      return segments
        .slice(0, -1)
        .map((_, index) => segments.slice(0, index + 1).join('/'));
    }),
  );
  const maximumDirectoryDepth = Math.max(
    ...[...allowedPaths].map(
      (allowedPath) => allowedPath.split('/').length - 1,
    ),
  );
  const maximumTraversedEntries =
    allowedPaths.size + allowedDirectories.size + 1;
  let traversedEntries = 0;
  let firstUnreferencedError: Error | undefined;
  const pendingDirectories = [{ depth: 0, path: approvedRoot }];
  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop() as {
      depth: number;
      path: string;
    };
    const handle = opendirSync(directory.path);
    try {
      for (let entry = handle.readSync(); entry; entry = handle.readSync()) {
        traversedEntries += 1;
        if (traversedEntries > maximumTraversedEntries)
          throw new Error('Retained report tree exceeds the entry limit.');
        const candidate = resolve(directory.path, entry.name);
        const rootRelativePath = relative(approvedRoot, candidate)
          .split(sep)
          .join('/');
        if (entry.isDirectory()) {
          if (allowedPaths.has(rootRelativePath)) continue;
          const candidateDepth = directory.depth + 1;
          if (candidateDepth > maximumDirectoryDepth)
            throw new Error('Retained report tree exceeds the maximum depth.');
          if (!allowedDirectories.has(rootRelativePath)) {
            firstUnreferencedError ??= new Error(
              `Unreferenced retained report directory: ${rootRelativePath}.`,
            );
            continue;
          }
          pendingDirectories.push({ depth: candidateDepth, path: candidate });
          continue;
        }
        if (!allowedPaths.has(rootRelativePath))
          firstUnreferencedError ??= new Error(
            `Unreferenced retained report file: ${rootRelativePath}.`,
          );
      }
    } finally {
      handle.closeSync();
    }
  }
  if (firstUnreferencedError) throw firstUnreferencedError;
};

const validateRetainedReportStat = (stat: Stats, label: string): void => {
  if (!stat.isFile())
    throw new Error(`Retained report must be a regular file: ${label}.`);
  if (stat.size === 0)
    throw new Error(`Retained report must not be empty: ${label}.`);
  if (stat.size > MAX_RETAINED_REPORT_BYTES)
    throw new Error(`Retained report exceeds the 10 MiB limit: ${label}.`);
};

export const readStableReport = (
  candidate: string,
  retainedPath: string,
  label: string,
): Readonly<{ bytes: Buffer; fileIdentity: string }> => {
  const retainedReportStat = statSync(retainedPath);
  validateRetainedReportStat(retainedReportStat, label);
  const descriptor = openSync(
    candidate,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const openedStat = fstatSync(descriptor);
    /* c8 ignore next 5 -- requires a concurrent path replacement during verification. */
    if (
      openedStat.dev !== retainedReportStat.dev ||
      openedStat.ino !== retainedReportStat.ino
    )
      throw new Error(`Retained report changed while opening: ${label}.`);
    validateRetainedReportStat(openedStat, label);
    const buffer = Buffer.allocUnsafe(openedStat.size + 1);
    let bytesRead = 0;
    for (;;) {
      const read = readSync(
        descriptor,
        buffer,
        bytesRead,
        buffer.length - bytesRead,
        null,
      );
      /* c8 ignore next -- the buffer fills only if the file grows after fstat. */
      if (read === 0 || bytesRead + read === buffer.length) {
        bytesRead += read;
        break;
      }
      bytesRead += read;
    }
    const completedStat = fstatSync(descriptor);
    /* c8 ignore next 7 -- requires concurrent in-place mutation during verification. */
    if (
      completedStat.dev !== openedStat.dev ||
      completedStat.ino !== openedStat.ino ||
      completedStat.size !== openedStat.size ||
      bytesRead !== openedStat.size
    )
      throw new Error(`Retained report changed while reading: ${label}.`);
    return {
      bytes: buffer.subarray(0, bytesRead),
      fileIdentity: `${openedStat.dev}:${openedStat.ino}`,
    };
  } finally {
    closeSync(descriptor);
  }
};

export const verifyContentSchemaRegistryRetainedReports = (
  evidence: ContentSchemaRegistryOperationalReleaseEvidence,
  expectedIdentity: OperationalReleaseEvidenceExpectedIdentity,
  reportRoot: string,
  hostedV3Verification: RetainedHostedE2eVerificationInput,
): void => {
  const approvedRoot = realpathSync(reportRoot);
  if (!statSync(approvedRoot).isDirectory())
    throw new Error('Retained report root must be a directory.');
  const references = retainedReports(evidence);
  const allowedPaths = new Set(
    references
      .map(([, reference]) => reference.path)
      .concat(
        existsSync(
          resolve(
            approvedRoot,
            CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH,
          ),
        )
          ? [CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH]
          : [],
      ),
  );
  verifyReportTree(approvedRoot, allowedPaths);
  const seenPaths = new Set<string>();
  const seenFileIdentities = new Set<string>();
  for (const [label, reference] of references) {
    const candidate = resolve(approvedRoot, reference.path);
    if (!existsSync(candidate))
      throw new Error(`Retained report is missing: ${label}.`);
    const retainedPath = realpathSync(candidate);
    const rootRelativePath = relative(approvedRoot, retainedPath);
    if (
      isAbsolute(rootRelativePath) ||
      rootRelativePath === '..' ||
      rootRelativePath.startsWith(`..${sep}`)
    )
      throw new Error(`Retained report escapes its approved root: ${label}.`);
    if (seenPaths.has(retainedPath))
      throw new Error(`Retained report path is duplicated: ${label}.`);
    seenPaths.add(retainedPath);
    const { bytes: reportBytes, fileIdentity } = readStableReport(
      candidate,
      retainedPath,
      label,
    );
    if (seenFileIdentities.has(fileIdentity))
      throw new Error(`Retained report file is duplicated: ${label}.`);
    seenFileIdentities.add(fileIdentity);
    if (label === 'hosted E2E') {
      validateAndBindRetainedHostedE2eReportV3(
        reportBytes,
        reference.sha256,
        hostedV3Verification,
        evidence,
        expectedIdentity,
      );
    } else if (label === 'automated accessibility') {
      validateContentSchemaRegistryAutomatedAxeReportBytes(
        reportBytes,
        reference.sha256,
        evidence.accessibility,
        expectedIdentity,
      );
    } else if (label === 'VoiceOver accessibility') {
      validateContentSchemaRegistryManualAccessibilityReportBytes(
        reportBytes,
        reference.sha256,
        evidence.accessibility.manualRuns[0],
        evidence.accessibility,
        evidence.hostedE2e,
        expectedIdentity,
      );
    } else if (label === 'NVDA accessibility') {
      validateContentSchemaRegistryManualAccessibilityReportBytes(
        reportBytes,
        reference.sha256,
        evidence.accessibility.manualRuns[1],
        evidence.accessibility,
        evidence.hostedE2e,
        expectedIdentity,
      );
    } else if (sha256Bytes(reportBytes) !== reference.sha256)
      throw new Error(`Retained report digest does not match: ${label}.`);
  }
  const automatedAxeDigestSidecarPath = resolve(
    approvedRoot,
    CONTENT_SCHEMA_REGISTRY_AUTOMATED_AXE_DIGEST_PATH,
  );
  if (existsSync(automatedAxeDigestSidecarPath)) {
    const retainedPath = realpathSync(automatedAxeDigestSidecarPath);
    const rootRelativePath = relative(approvedRoot, retainedPath);
    if (
      isAbsolute(rootRelativePath) ||
      rootRelativePath === '..' ||
      rootRelativePath.startsWith(`..${sep}`)
    )
      throw new Error(
        'Automated axe digest sidecar escapes its approved root.',
      );
    const label = 'automated accessibility digest sidecar';
    if (seenPaths.has(retainedPath))
      throw new Error(`Retained report path is duplicated: ${label}.`);
    seenPaths.add(retainedPath);
    const { bytes: sidecarBytes, fileIdentity } = readStableReport(
      automatedAxeDigestSidecarPath,
      retainedPath,
      label,
    );
    if (seenFileIdentities.has(fileIdentity))
      throw new Error(`Retained report file is duplicated: ${label}.`);
    seenFileIdentities.add(fileIdentity);
    const sidecarDigest = parseContentSchemaRegistryAutomatedAxeDigestSidecar(
      sidecarBytes.toString('utf8'),
    );
    if (sidecarDigest !== evidence.accessibility.automatedReport.sha256)
      throw new Error(
        'Automated axe digest sidecar does not match the report.',
      );
  }
};

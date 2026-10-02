import {
  parseAc265HostedVerificationArchives,
  type Ac265HostedVerificationArchive,
} from './ac265-hosted-verification-archive-bundle.ts';
import {
  parseAc265ApprovedOutageTargetTrustedKeys,
  parseAc265ApprovedRunnerMappingTrustedKeys,
  parseAc265ArtifactTrustedKeys,
  parseAc265SourceManifestExpected,
  parseAc265SourceManifestTrustedKeys,
} from './ac265-hosted-verification-bundle-keys.ts';
import { failAc265HostedVerification } from './ac265-hosted-verification-bundle-errors.ts';
import { parseJsonBytesWithoutDuplicateMembers } from './strict-json-object-members.ts';

export { AC265_HOSTED_SCOPE_FAILURE } from './ac265-hosted-verification-bundle-errors.ts';

export { parseAc265ArtifactTrustedKeys as parseArtifactTrustedKeys } from './ac265-hosted-verification-bundle-keys.ts';

export const AC265_HOSTED_VERIFICATION_BUNDLE_SCHEMA =
  'ac265-hosted-verification-context-v1';

const MAX_BUNDLE_BASE64_BYTES = 400_000;
const MAX_BUNDLE_BYTES = 256 * 1024;
const MAX_DEPTH = 24;
const MAX_KEYS = 512;
const MAX_ARRAY = 4096;
const MAX_STRING = 64 * 1024;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const requireRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : failAc265HostedVerification();

const requireMembers = (
  value: Record<string, unknown>,
  members: readonly string[],
): void => {
  const permitted = new Set(members);
  for (const key of Object.keys(value)) {
    if (
      !permitted.has(key) ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    )
      return failAc265HostedVerification();
  }
};

const walkBounds = (value: unknown, depth = 0): void => {
  if (depth > MAX_DEPTH) return failAc265HostedVerification();
  if (typeof value === 'string') {
    if (value.length === 0 || value.length > MAX_STRING || value.includes('\0'))
      return failAc265HostedVerification();
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) return failAc265HostedVerification();
    value.forEach((entry) => walkBounds(entry, depth + 1));
    return;
  }
  if (!isRecord(value)) return;
  const keys = Object.keys(value);
  if (keys.length > MAX_KEYS) return failAc265HostedVerification();
  keys.forEach((key) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      return failAc265HostedVerification();
    walkBounds(value[key], depth + 1);
  });
};

export const decodeAc265ContextBundleBase64 = (value: unknown): Uint8Array => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_BUNDLE_BASE64_BYTES ||
    value.length % 4 !== 0 ||
    !BASE64.test(value)
  )
    return failAc265HostedVerification();
  const decoded = Buffer.from(value, 'base64');
  if (
    decoded.byteLength === 0 ||
    decoded.byteLength > MAX_BUNDLE_BYTES ||
    decoded.toString('base64') !== value
  )
    return failAc265HostedVerification();
  return decoded;
};

const requireBase64Bytes = (value: unknown): Uint8Array => {
  try {
    return decodeAc265ContextBundleBase64(value);
  } catch {
    return failAc265HostedVerification();
  }
};

const requireMemberName = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4096 ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value
      .split('/')
      .some((part) => part === '' || part === '.' || part === '..')
  )
    return failAc265HostedVerification();
  return value;
};

const requireDigest = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))
    return failAc265HostedVerification();
  return value;
};

export type {
  Ac265HostedVerificationArchive,
  Ac265HostedVerificationArchiveSource,
} from './ac265-hosted-verification-archive-bundle.ts';

export interface Ac265HostedVerificationContextBundle {
  readonly schemaVersion: typeof AC265_HOSTED_VERIFICATION_BUNDLE_SCHEMA;
  readonly repository: 'WeJustJammin/wejammin';
  readonly runnerContractBytes: Uint8Array;
  readonly trustedCutoffAt: string;
  readonly maxRunDurationMs: number;
  readonly approvedRunnerMappingsBase64: string;
  readonly approvedRunnerMappingAttestationBase64: string;
  readonly approvedRunnerMappingTrustedKeys: ReturnType<
    typeof parseAc265ApprovedRunnerMappingTrustedKeys
  >;
  readonly approvedOutageTargetBase64: string;
  readonly approvedOutageTargetAttestationBase64: string;
  readonly approvedOutageTargetTrustedKeys: ReturnType<
    typeof parseAc265ApprovedOutageTargetTrustedKeys
  >;
  readonly sourceManifestBase64: string;
  readonly sourceManifestExpected: ReturnType<
    typeof parseAc265SourceManifestExpected
  >;
  readonly sourceManifestTrustedKeys: ReturnType<
    typeof parseAc265SourceManifestTrustedKeys
  >;
  readonly artifactTrustedKeys: ReturnType<
    typeof parseAc265ArtifactTrustedKeys
  >;
  /** Archive member holding the exact report body bytes. */
  readonly reportArchiveMember: string;
  /**
   * Digest the protected owner pinned for the report body. It authenticates
   * the report body independently of both the archive digest reported by
   * GitHub and the report bytes being checked.
   */
  readonly reportBodySha256: string;
  readonly archives: readonly Ac265HostedVerificationArchive[];
}

export const parseAc265HostedVerificationContextBundle = (
  bundleBytes: Uint8Array,
): Ac265HostedVerificationContextBundle => {
  if (
    !(bundleBytes instanceof Uint8Array) ||
    bundleBytes.byteLength === 0 ||
    bundleBytes.byteLength > MAX_BUNDLE_BYTES
  )
    return failAc265HostedVerification();
  let parsed: unknown;
  try {
    parsed = parseJsonBytesWithoutDuplicateMembers(
      bundleBytes,
      'AC265 hosted verification context bundle',
    );
  } catch {
    return failAc265HostedVerification();
  }
  walkBounds(parsed);
  const root = requireRecord(parsed);
  requireMembers(root, [
    'schemaVersion',
    'repository',
    'runnerContractBase64',
    'trustedCutoffAt',
    'maxRunDurationMs',
    'approvedRunnerMappingsBase64',
    'approvedRunnerMappingAttestationBase64',
    'approvedRunnerMappingTrustedKeys',
    'approvedOutageTargetBase64',
    'approvedOutageTargetAttestationBase64',
    'approvedOutageTargetTrustedKeys',
    'sourceManifestBase64',
    'sourceManifestExpected',
    'sourceManifestTrustedKeys',
    'artifactTrustedKeys',
    'reportArchiveMember',
    'reportBodySha256',
    'archives',
  ]);
  if (
    root['schemaVersion'] !== AC265_HOSTED_VERIFICATION_BUNDLE_SCHEMA ||
    root['repository'] !== 'WeJustJammin/wejammin'
  )
    return failAc265HostedVerification();
  const trustedCutoffAt = root['trustedCutoffAt'];
  if (
    typeof trustedCutoffAt !== 'string' ||
    !Number.isFinite(Date.parse(trustedCutoffAt))
  )
    return failAc265HostedVerification();
  const maxRunDurationMs = root['maxRunDurationMs'];
  if (
    typeof maxRunDurationMs !== 'number' ||
    !Number.isSafeInteger(maxRunDurationMs) ||
    maxRunDurationMs <= 0
  )
    return failAc265HostedVerification();
  const requireBase64String = (value: unknown): string => {
    requireBase64Bytes(value);
    return value as string;
  };
  return Object.freeze({
    schemaVersion: AC265_HOSTED_VERIFICATION_BUNDLE_SCHEMA,
    repository: 'WeJustJammin/wejammin',
    runnerContractBytes: requireBase64Bytes(root['runnerContractBase64']),
    trustedCutoffAt,
    maxRunDurationMs,
    approvedRunnerMappingsBase64: requireBase64String(
      root['approvedRunnerMappingsBase64'],
    ),
    approvedRunnerMappingAttestationBase64: requireBase64String(
      root['approvedRunnerMappingAttestationBase64'],
    ),
    approvedRunnerMappingTrustedKeys:
      parseAc265ApprovedRunnerMappingTrustedKeys(
        root['approvedRunnerMappingTrustedKeys'],
      ),
    approvedOutageTargetBase64: requireBase64String(
      root['approvedOutageTargetBase64'],
    ),
    approvedOutageTargetAttestationBase64: requireBase64String(
      root['approvedOutageTargetAttestationBase64'],
    ),
    approvedOutageTargetTrustedKeys: parseAc265ApprovedOutageTargetTrustedKeys(
      root['approvedOutageTargetTrustedKeys'],
    ),
    sourceManifestBase64: requireBase64String(root['sourceManifestBase64']),
    sourceManifestExpected: parseAc265SourceManifestExpected(
      root['sourceManifestExpected'],
    ),
    sourceManifestTrustedKeys: parseAc265SourceManifestTrustedKeys(
      root['sourceManifestTrustedKeys'],
    ),
    artifactTrustedKeys: parseAc265ArtifactTrustedKeys(
      root['artifactTrustedKeys'],
    ),
    reportArchiveMember: requireMemberName(root['reportArchiveMember']),
    reportBodySha256: requireDigest(root['reportBodySha256']),
    archives: parseAc265HostedVerificationArchives(root['archives']),
  });
};

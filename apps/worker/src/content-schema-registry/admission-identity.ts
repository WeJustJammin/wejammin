import { CmsInstantSchema } from './contracts';
import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistrySession,
  ReleasePrincipal,
} from './types';
import { UUID_PATTERN } from './admission-common';

const DESIGNER = ['cms.schema_designer'] as const;

/**
 * Human operations opened by any one listed capability (BE03a authorization
 * matrix). Capabilities never substitute across rows: reviewers and assigners
 * cannot design, and CMS-03A-13 admits the designer scope or the assigned
 * review scope but not the registry-read scope. The owner-only grant
 * operations (CMS-03A-15..18) carry no capability key; the named RPC derives
 * the owner from the immutable owner initialization receipt.
 */
const CAPABILITIES_BY_OPERATION: Readonly<
  Partial<Record<ContentSchemaRegistryOperationId, readonly string[]>>
> = {
  'CMS-03A-01': DESIGNER,
  'CMS-03A-02': DESIGNER,
  'CMS-03A-03': DESIGNER,
  'CMS-03A-04': DESIGNER,
  'CMS-03A-06': ['cms.schema_registry.read', 'cms.schema_designer'],
  'CMS-03A-07': ['cms.schema_registry.read', 'cms.schema_designer'],
  'CMS-03A-09': DESIGNER,
  'CMS-03A-10': DESIGNER,
  'CMS-03A-11': DESIGNER,
  'CMS-03A-12': ['cms.schema_review'],
  'CMS-03A-13': ['cms.schema_designer', 'cms.schema_review'],
  'CMS-03A-14': ['cms.schema_review.assign'],
};

const OWNER_DERIVED_OPERATIONS: ReadonlySet<ContentSchemaRegistryOperationId> =
  new Set(['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17', 'CMS-03A-18']);

export const requireCapability = (
  session: ContentSchemaRegistrySession,
  operationId: ContentSchemaRegistryOperationId,
): ContentSchemaRegistryError | null => {
  if (OWNER_DERIVED_OPERATIONS.has(operationId)) return null;
  // An operation without a mapped capability fails closed.
  const required = CAPABILITIES_BY_OPERATION[operationId] ?? [];
  return required.some((capability) =>
    session.capabilities.includes(capability),
  )
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The required CMS capability is not granted.',
        details: { reasonCode: 'CAPABILITY_REQUIRED' },
      };
};

export const requireReleaseCapability = (
  principal: ReleasePrincipal,
): ContentSchemaRegistryError | null =>
  principal.capabilities.includes('release.block_registry.write')
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The release principal is not allowed for this operation.',
        details: { reasonCode: 'CAPABILITY_REQUIRED' },
      };

export const validHumanSession = (
  session: ContentSchemaRegistrySession,
): ContentSchemaRegistryError | null => {
  const value = session as unknown as Record<string, unknown>;
  const capabilities = value.capabilities;
  const valid =
    typeof value.userId === 'string' &&
    UUID_PATTERN.test(value.userId) &&
    (value.actingPartyId === null ||
      (typeof value.actingPartyId === 'string' &&
        UUID_PATTERN.test(value.actingPartyId))) &&
    Array.isArray(capabilities) &&
    capabilities.every((capability) => typeof capability === 'string') &&
    typeof value.mfaFresh === 'boolean';
  return valid
    ? null
    : {
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'The authentication context is invalid.',
        details: { recoveryAction: 'reauthenticate' },
      };
};

export const validReleasePrincipal = (
  principal: ReleasePrincipal,
  keyId: string,
): ContentSchemaRegistryError | null => {
  const value = principal as unknown as Record<string, unknown>;
  const capabilities = value.capabilities;
  const valid =
    value.keyId === keyId &&
    typeof value.principalId === 'string' &&
    value.principalId.length > 0 &&
    Array.isArray(capabilities) &&
    capabilities.every((capability) => typeof capability === 'string') &&
    typeof value.verifiedAt === 'string' &&
    CmsInstantSchema.safeParse(value.verifiedAt).success &&
    typeof value.rawBodyHash === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.rawBodyHash) &&
    typeof value.signatureHash === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.signatureHash) &&
    typeof value.nonceHash === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.nonceHash);
  return valid
    ? null
    : {
        ok: false,
        status: 401,
        code: 'WEBHOOK_REJECTED',
        message: 'The signed release webhook was rejected.',
        details: {},
      };
};

import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildProjection,
  CanonicalStateError,
} from './content-schema-registry-canonical-state-validate';
import { loadContractValidators } from './content-schema-registry-contract-validators';

// The strict resource contracts load lazily in the browser; this suite checks
// the strict verdicts themselves, so it loads them first.
beforeAll(async () => {
  await loadContractValidators();
});

/**
 * R8 proof for AC260: the browser parser accepts only the safe
 * `BlockDefinitionRegistryRecord` projection. A full block registration
 * resource, a lifecycle event and a WEBHOOK_REJECTED error are each fed through
 * the real canonical projection validator and refused.
 */

const HASH = 'a'.repeat(64);
const ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const T0 = '2026-10-02T12:00:00.000Z';

const SAFE_BLOCK = {
  resourceKind: 'block_definition_registry_record',
  id: ID,
  version: '2',
  blockKey: 'hero.banner',
  blockVersion: 2,
  propsSchemaRef: 'cms/hero-banner',
  propsSchemaHash: HASH,
  rendererRef: 'blocks/hero-banner',
  releaseDigest: HASH,
  lifecycle: 'supported',
};

const propsWith = (item: unknown, extra: Record<string, unknown> = {}) => ({
  access: 'read-only',
  variant: 'entitledRead',
  initialList: {
    status: 'success',
    data: { items: [item], nextCursor: null },
    version: '1',
    stale: false,
    ...extra,
  },
  initialDetail: null,
  initialReview: null,
});

describe('[P2-S09-AC-260] browser block projection', () => {
  it('[P2-S09-AC-260] accepts the safe block registry record', () => {
    expect(() => buildProjection(propsWith(SAFE_BLOCK))).not.toThrow();
  });

  it('[P2-S09-AC-260] refuses a full block registration resource', () => {
    const full = {
      ...SAFE_BLOCK,
      resourceKind: 'block_definition_version',
      releaseKeyId: 'release-key-1',
      releaseRawBodyHash: HASH,
      releaseSignatureHash: HASH,
      releaseNonceHash: HASH,
      releaseVerifiedAt: T0,
      propsSnapshotHash: HASH,
    };
    expect(() => buildProjection(propsWith(full))).toThrow(CanonicalStateError);
  });

  it('[P2-S09-AC-260] refuses a safe block record that carries worker release evidence', () => {
    const leaked = { ...SAFE_BLOCK, releaseKeyId: 'release-key-1' };
    expect(() => buildProjection(propsWith(leaked))).toThrow(
      CanonicalStateError,
    );
  });

  it('[P2-S09-AC-260] refuses a block lifecycle event resource', () => {
    const event = {
      resourceKind: 'block_definition_lifecycle_event',
      id: ID,
      version: '1',
      blockDefinitionVersionId: ID,
      blockKey: 'hero.banner',
      blockVersion: 2,
      fromLifecycle: 'supported',
      toLifecycle: 'deprecated',
      lifecycle: 'deprecated',
      releaseDigest: HASH,
      eventType: 'cms.block.lifecycle.changed.v1',
      createdAt: T0,
    };
    expect(() => buildProjection(propsWith(event))).toThrow(
      CanonicalStateError,
    );
  });

  it('[P2-S09-AC-260] refuses a WEBHOOK_REJECTED error state', () => {
    const props = {
      access: 'read-only',
      variant: 'entitledRead',
      initialList: {
        status: 'error',
        error: {
          code: 'WEBHOOK_REJECTED',
          message: 'The webhook was not accepted.',
          requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
          details: null,
        },
        retryable: false,
      },
      initialDetail: null,
      initialReview: null,
    };
    expect(() => buildProjection(props)).toThrow(CanonicalStateError);
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  baseRevisionId,
  resolvedRevisionId,
  restoreVerification,
  resource,
} from './cms-editorial/route-fixtures.test-support';
import { json } from './cms-editorial-production.test-support';
import {
  restoreRequest,
  wiredApp,
} from './cms-editorial-production-app.test-support';

/**
 * BE03b D6 (:1213): a restore chain is at most 64 completed plan edges, so it
 * names at most 65 schema versions (the source plus one per edge). The Worker
 * must accept a maximal chain and refuse one more, end to end through the real
 * restore route and production restore port.
 */

const chainOf = (versions: number): readonly string[] =>
  Array.from(
    { length: versions },
    (_value, index) =>
      `7${String(index).padStart(7, '0')}-0000-4000-8000-000000000007`,
  );

const envelopeWithChain = (versions: number) => {
  const chain = chainOf(versions);
  return {
    resource: {
      ...resource(resolvedRevisionId, '3', '3'),
      parentRevisionIds: [baseRevisionId],
    },
    restoreVerification: {
      ...restoreVerification,
      registry: {
        ...restoreVerification.registry,
        sourceSchemaVersionId: chain[0],
        activeSchemaVersionId: chain[chain.length - 1],
        chainSchemaVersionIds: chain,
      },
    },
  };
};

describe('restore chain length bound', () => {
  it('[P2-S10-AC-022] accepts a 64-edge chain naming 65 schema versions', async () => {
    const fetchImpl = vi.fn(async () => json(envelopeWithChain(65)));
    const response = await restoreRequest(
      wiredApp(fetchImpl as unknown as typeof fetch),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"3"');
  });

  it('refuses a chain of 66 schema versions as an invalid dependency response', async () => {
    const fetchImpl = vi.fn(async () => json(envelopeWithChain(66)));
    const response = await restoreRequest(
      wiredApp(fetchImpl as unknown as typeof fetch),
    );
    expect(response.status).toBe(502);
  });
});

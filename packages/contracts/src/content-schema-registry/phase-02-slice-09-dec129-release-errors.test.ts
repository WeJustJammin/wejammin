import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildContentSchemaRegistryOpenApiDocument,
  contentSchemaRegistryRoutePolicies,
} from './index';

/**
 * DEC-129 (owner): CMS-03A-05 creates the (blockKey, blockVersion) pair it
 * registers, and nothing it names can be "unknown" without contradicting another
 * clause, so the "unknown release target is 404" clause is deleted. CMS-03A-08
 * names an existing block version and keeps its 404.
 */
const policy = (operationId: string) =>
  contentSchemaRegistryRoutePolicies.find(
    (route) => route.operationId === operationId,
  );

const SPEC = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../.memory/wiki/specs/be/03a-content-schema-registry.md',
  ),
  'utf8',
);

type OpenApi = ReturnType<typeof buildContentSchemaRegistryOpenApiDocument>;
const responses = (document: OpenApi, path: string): Record<string, unknown> =>
  (
    (document.paths[path] as Record<string, { responses: object }>).post as {
      responses: Record<string, unknown>;
    }
  ).responses;

describe('DEC-129 CMS-03A-05 declares no 404', () => {
  it('[P2-S09-AC-034] declares no NOT_FOUND for the registration and keeps it for the lifecycle advance', () => {
    expect(Object.keys(policy('CMS-03A-05')?.errors ?? {})).not.toContain(
      'NOT_FOUND',
    );
    expect(policy('CMS-03A-08')?.errors).toMatchObject({ NOT_FOUND: 404 });
  });

  it('[P2-S09-AC-034] publishes no 404 response for the registration and a 404 for the lifecycle advance', () => {
    const document = buildContentSchemaRegistryOpenApiDocument();
    expect(
      Object.keys(responses(document, '/api/v1/cms/blocks/versions')),
    ).not.toContain('404');
    expect(
      Object.keys(
        responses(
          document,
          '/api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle',
        ),
      ),
    ).toContain('404');
  });

  it('[P2-S09-AC-034] BE03a no longer lists an unknown release target for CMS-03A-05 in the route row, error matrix or authorization matrix', () => {
    const [body = '', changelog = ''] = SPEC.split('## Changelog');
    expect(body).not.toMatch(/unknown release target/iu);
    expect(body).not.toMatch(/unknown release registration target/iu);
    expect(body).not.toMatch(/unregistered release target/iu);
    expect(changelog).toMatch(/DEC-129 \(owner\)/u);
  });
});

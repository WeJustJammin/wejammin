import { describe, expect, it } from 'vitest';

import {
  buildContentSchemaRegistryBrowserOpenApiDocument,
  buildContentSchemaRegistryOpenApiDocument,
  contentSchemaRegistryRoutePolicies,
} from '../../packages/contracts/src/content-schema-registry';
import {
  CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS,
  contentSchemaRegistryMutationOperationFromRequest,
} from '../../apps/web/src/server/content-schema-registry-platform-api';
import { validBlock } from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-test-values';
import type { OperationId } from './phase-02-slice-09-operation-boundaries-fields';

describe('P2-S09 release/read boundaries', () => {
  it('[P2-S09-AC-264] covers A05-A08 signed-release/read boundaries at executable browser facades', async () => {
    const byId = Object.fromEntries(
      contentSchemaRegistryRoutePolicies.map((route) => [
        route.operationId,
        route,
      ]),
    ) as Partial<
      Record<OperationId, (typeof contentSchemaRegistryRoutePolicies)[number]>
    >;

    for (const operationId of ['CMS-03A-05', 'CMS-03A-08'] as const) {
      expect(byId[operationId]?.auth).toBe('signed_release_worker');
      expect(byId[operationId]?.audience).toBe('release-worker');
      expect(byId[operationId]?.rawBodySignature).toBe('required');
      expect(byId[operationId]?.csrf).toBe('forbidden');
      expect(byId[operationId]?.idempotency).toBe('required');
    }
    for (const operationId of ['CMS-03A-06', 'CMS-03A-07'] as const) {
      expect(byId[operationId]?.method).toBe('GET');
      expect(byId[operationId]?.audience).toBe('browser');
      expect(byId[operationId]?.rawBodySignature).toBe('none');
      expect(byId[operationId]?.csrf).toBe('none');
      expect(byId[operationId]?.idempotency).toBe('none');
      expect(byId[operationId]?.ifMatch).toBe('none');
    }

    // The browser facade carries human console commands only: the original
    // four are always present, and no release command, protected read, or
    // owner grant read is ever a browser mutation target.
    const facadeOperations = Object.keys(
      CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS,
    );
    for (const operationId of [
      'CMS-03A-01',
      'CMS-03A-02',
      'CMS-03A-03',
      'CMS-03A-04',
    ])
      expect(facadeOperations).toContain(operationId);
    for (const operationId of [
      'CMS-03A-05',
      'CMS-03A-06',
      'CMS-03A-07',
      'CMS-03A-08',
      'CMS-03A-13',
      'CMS-03A-18',
    ])
      expect(facadeOperations).not.toContain(operationId);
    for (const operationId of facadeOperations) {
      const policy = contentSchemaRegistryRoutePolicies.find(
        (route) => route.operationId === operationId,
      );
      expect(policy?.method, operationId).toBe('POST');
      expect(policy?.audience, operationId).toBe('browser');
    }
    const browserPaths = Object.keys(
      buildContentSchemaRegistryBrowserOpenApiDocument().paths,
    );
    expect(browserPaths.some((path) => path.includes('/blocks/'))).toBe(false);
    const internalPaths = Object.keys(
      buildContentSchemaRegistryOpenApiDocument().paths,
    );
    expect(
      internalPaths.some((path) => path === '/api/v1/cms/blocks/versions'),
    ).toBe(true);
    expect(
      internalPaths.some((path) =>
        path.includes('/blocks/versions/{blockDefinitionVersionId}'),
      ),
    ).toBe(true);

    const releaseJson = new Request(
      'https://cms.test/app/cms-content-modeling',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationId: 'CMS-03A-05', ...validBlock }),
      },
    );
    expect(
      await contentSchemaRegistryMutationOperationFromRequest(releaseJson),
    ).toBeNull();
    const lifecycleForm = new FormData();
    lifecycleForm.set('operationId', 'CMS-03A-08');
    const releaseForm = new Request(
      'https://cms.test/app/cms-content-modeling',
      {
        method: 'POST',
        body: lifecycleForm,
      },
    );
    expect(
      await contentSchemaRegistryMutationOperationFromRequest(releaseForm),
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import {
  assertContentSchemaRegistryRouteRegistry,
  contentSchemaRegistryRoutePolicies,
} from './index.ts';

describe('content schema registry route policy defensive checks', () => {
  it('rejects distinct operations that reuse a method and path', () => {
    const duplicatePath = {
      ...contentSchemaRegistryRoutePolicies[1],
      path: contentSchemaRegistryRoutePolicies[0].path,
    };
    expect(() =>
      assertContentSchemaRegistryRouteRegistry([
        contentSchemaRegistryRoutePolicies[0],
        duplicatePath,
        ...contentSchemaRegistryRoutePolicies.slice(2),
      ]),
    ).toThrow(/Duplicate content schema registry route/u);
  });

  it('rejects a full-length registry with a missing operation id', () => {
    const unknownOperation = {
      ...contentSchemaRegistryRoutePolicies[13],
      operationId: 'CMS-03A-15',
      path: '/api/v1/cms/blocks/versions/missing/lifecycle',
    } as unknown as (typeof contentSchemaRegistryRoutePolicies)[number];
    expect(() =>
      assertContentSchemaRegistryRouteRegistry([
        ...contentSchemaRegistryRoutePolicies.slice(0, 13),
        unknownOperation,
      ]),
    ).toThrow(/Missing content schema registry operation/u);
  });
});

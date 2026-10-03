/**
 * CMS-03A-02 Worker -> database request shape (AC064, AC060).
 *
 * BE03a's FieldSchemaChangeRequest is flat on the wire, but cms_add_field_definition
 * takes the field definition as one `field` member beside `migrationPlanId` and
 * `expectedVersion` (its exact-key check refuses anything else). The production
 * adapter must therefore reshape the contract-valid body, and it must keep the
 * missing/null distinction of `defaultValue` while doing so: an absent key stays
 * absent and an explicit JSON null stays an explicit null.
 */
import { describe, expect, it, vi } from 'vitest';

import { createProductionContentSchemaRegistryDependencies } from './production';
import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  json,
  options,
  request,
  session,
} from './production-test-support';
import type { ContentSchemaRegistryPortInput } from './types';

const FIELD = {
  key: 'subtitle',
  kind: 'short_text',
  constraints: {},
  required: false,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: 'Subtitle', order: 2 },
  lifecycle: 'active',
} as const;

const sentRequest = async (
  body: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> => {
  const fetchImpl = vi.fn<typeof fetch>(async () => json({}));
  const dependencies = createProductionContentSchemaRegistryDependencies(
    options(fetchImpl),
  );
  await dependencies.ports.addFieldDefinition(
    {
      operationId: 'CMS-03A-02',
      requestId: REQUEST_ID,
      request,
      session,
      path: { contentTypeId: USER_ID, versionId: PARTY_ID },
      body,
      idempotencyKey: 'cms-field-shape-001',
      ifMatch: '7',
    } as unknown as ContentSchemaRegistryPortInput,
    new AbortController().signal,
  );
  const sent = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
    p_request: Record<string, unknown>;
  };
  return sent.p_request;
};

describe('CMS-03A-02 production RPC request shape', () => {
  it('[P2-S09-AC-064] sends the field definition as one `field` member beside migrationPlanId and expectedVersion', async () => {
    const sent = await sentRequest({ ...FIELD, migrationPlanId: null });
    expect(Object.keys(sent).sort()).toEqual([
      'contentTypeId',
      'context',
      'expectedVersion',
      'field',
      'idempotencyKey',
      'ifMatch',
      'migrationPlanId',
      'versionId',
    ]);
    expect(sent.field).toEqual(FIELD);
    expect(sent.migrationPlanId).toBeNull();
    expect(sent.expectedVersion).toBe('7');
  });

  it('[P2-S09-AC-064] keeps the missing/null distinction of defaultValue: an explicit JSON null stays present and an absent key stays absent', async () => {
    const literalNull = await sentRequest({
      ...FIELD,
      defaultMode: 'literal',
      defaultValue: null,
      migrationPlanId: null,
    });
    const field = literalNull.field as Record<string, unknown>;
    expect(Object.hasOwn(field, 'defaultValue')).toBe(true);
    expect(field.defaultValue).toBeNull();

    const missing = await sentRequest({ ...FIELD, migrationPlanId: null });
    expect(Object.hasOwn(missing.field as object, 'defaultValue')).toBe(false);
  });

  it('[P2-S09-AC-064] carries a migration plan id beside, never inside, the field', async () => {
    const planId = '50000000-0000-4000-8000-000000000005';
    const sent = await sentRequest({ ...FIELD, migrationPlanId: planId });
    expect(sent.migrationPlanId).toBe(planId);
    expect(sent.field).not.toHaveProperty('migrationPlanId');
  });
});

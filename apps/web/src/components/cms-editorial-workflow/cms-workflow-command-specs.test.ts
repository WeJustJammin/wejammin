import { cmsEditorialRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  COMMAND_CASES,
  REVOKE_CASE,
  type CommandCase,
} from '../../server/cms-workflow-platform-command.test-support';
import {
  WORKFLOW_COMMAND_SPECS,
  verifyCommandSuccess,
  type CmsWorkflowCommandOperationId,
} from './cms-workflow-command-specs';

/*
 * The spec table is the one place the proxy and the browser decide what a
 * committed command looks like, so it is held to the generated registry row:
 * path template, success status, validator, Location and step-up requirement.
 */
const OPERATIONS = Object.keys(
  WORKFLOW_COMMAND_SPECS,
) as CmsWorkflowCommandOperationId[];

const rowOf = (operationId: CmsWorkflowCommandOperationId) =>
  cmsEditorialRoutePolicies.find((row) => row.operationId === operationId)!;

const verify = (
  testCase: CommandCase,
  answer: Partial<{
    status: number;
    json: unknown;
    etag: string | null;
    location: string | null;
  }> = {},
) => {
  const spec = WORKFLOW_COMMAND_SPECS[testCase.operationId];
  return verifyCommandSuccess(
    spec as never,
    testCase.params as never,
    spec.requestSchema.parse(testCase.body) as never,
    {
      status: testCase.successStatus,
      json: testCase.resource,
      etag: testCase.etag,
      location: testCase.location,
      ...answer,
    },
  );
};

describe('workflow command specs follow the generated registry', () => {
  it.each(OPERATIONS)('%s names the registry path, status and guards', (id) => {
    const row = rowOf(id);
    const testCase = COMMAND_CASES[id];
    const spec = WORKFLOW_COMMAND_SPECS[id];
    expect(row.method).toBe('POST');
    expect(row.ifMatch).toBe('required');
    expect(row.idempotency).toBe('required');
    expect(row.csrf).toBe('required');
    expect(
      spec.successStatus(spec.requestSchema.parse(testCase.body) as never),
    ).toBe(row.successStatus);
    expect(
      row.path
        .replace('{entryId}', testCase.params.entryId ?? '')
        .replace('{reviewId}', testCase.params.reviewId ?? ''),
    ).toBe(testCase.upstreamPath);
    const resource = spec.resourceSchema.parse(testCase.resource);
    expect(spec.etag(resource as never) !== null).toBe(row.etag === 'strong');
    const location = spec.location(
      testCase.params as never,
      spec.requestSchema.parse(testCase.body) as never,
      resource as never,
    );
    expect(location !== null).toBe(row.location !== 'none');
  });

  it('declares step-up for exactly the four unconditional-MFA commands', () => {
    expect(OPERATIONS.filter((id) => rowOf(id).stepUp === 'required')).toEqual([
      'CMS-03B-06',
      'CMS-03B-07',
      'CMS-03B-09',
      'CMS-03B-18',
    ]);
  });

  it('answers a revoke 200 without a Location where the registry says on_create', () => {
    expect(rowOf('CMS-03B-18').location).toBe('on_create');
    expect(
      (rowOf('CMS-03B-18') as { additionalSuccessStatuses?: readonly number[] })
        .additionalSuccessStatuses,
    ).toEqual([200]);
    expect(verify(REVOKE_CASE)).not.toBeNull();
  });
});

describe('verifyCommandSuccess', () => {
  it.each(OPERATIONS)('%s accepts only the exact committed answer', (id) => {
    const testCase = COMMAND_CASES[id];
    expect(verify(testCase)).not.toBeNull();
    expect(verify(testCase, { status: 500 })).toBeNull();
    expect(verify(testCase, { json: { id: 1 } })).toBeNull();
    expect(verify(testCase, { json: testCase.mismatched })).toBeNull();
    if (testCase.etag !== null) {
      expect(verify(testCase, { etag: null })).toBeNull();
      expect(verify(testCase, { etag: '"999"' })).toBeNull();
    } else expect(verify(testCase, { etag: '"999"' })).not.toBeNull();
    if (testCase.location !== null) {
      expect(verify(testCase, { location: null })).toBeNull();
      expect(verify(testCase, { location: '/elsewhere' })).toBeNull();
    } else expect(verify(testCase, { location: '/elsewhere' })).not.toBeNull();
  });
});

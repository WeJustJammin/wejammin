/** Genuine edge grammar probes; no worker or fabricated completed evidence. */
import { CmsUuidSchema } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  CmsSchemaDryRunClaimRequestSchema,
  type CmsSchemaDryRunClaimRequest,
} from '../../apps/worker/src/content-schema-registry/schema-dry-run-claim-request';
import { CmsSchemaDryRunClaimResponseSchema } from '../../apps/worker/src/content-schema-registry/schema-dry-run-claim-response';
import { expectSafeEqual } from './support/phase-02-slice-11-assert';
import {
  claimAttempt,
  legacyRequest,
  observeRead,
  prepareClaimAttempt,
  resolveClaim,
  selectText,
  type ClaimAttempt,
} from './support/phase-02-slice-11-claimed-dry-run-fixture';
import {
  accepted,
  refusal,
} from './support/phase-02-slice-11-claimed-dry-run-oracles';
import { API_URL, tokenFor } from './support/stack';

let attempt: ClaimAttempt;
let request: CmsSchemaDryRunClaimRequest;

beforeAll(async () => {
  attempt = await prepareClaimAttempt();
  // Only genuine producers may supply the job ID; retry at most seven times.
  for (
    let retry = 0;
    retry < 7 && !/[a-f]/u.test(attempt.report.jobId);
    retry += 1
  ) {
    attempt = await prepareClaimAttempt(attempt.owner);
  }
  expect(/[a-f]/u.test(attempt.report.jobId), 'job UUID has a letter').toBe(
    true,
  );
  request = await claimAttempt(attempt);
});

describe('genuine claimed dry-run resolver edge grammar', () => {
  it('rejects raw uppercase claimed job identity against the canonical original event', async () => {
    const input = {
      ...request,
      claimedJob: {
        ...request.claimedJob,
        jobId: request.claimedJob.jobId.toUpperCase(),
      },
    };
    expect(
      CmsUuidSchema.safeParse(input.claimedJob.jobId).success &&
        CmsUuidSchema.safeParse(input.requestedEvent.aggregateId).success,
      'both individual UUID values remain valid',
    ).toBe(true);
    expect(
      input.claimedJob.jobId !== input.requestedEvent.aggregateId,
      'raw identity spellings differ',
    ).toBe(true);
    expectSafeEqual(
      input.requestedEvent,
      attempt.event,
      'all original event fields remain unchanged',
    );
    expect(
      CmsSchemaDryRunClaimRequestSchema.safeParse(input).success,
      'private request rejects the raw identity relation',
    ).toBe(false);
    refusal(await resolveClaim(input), 'INVALID_REQUEST');
  });

  it('returns semantic CONFLICT for a valid lowercase max UUID wrong lease token', async () => {
    const token = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const input = {
      ...request,
      claimedJob: { ...request.claimedJob, leaseToken: token },
    };
    expect(
      CmsSchemaDryRunClaimRequestSchema.safeParse(input).success,
      'lowercase max UUID is valid private request syntax',
    ).toBe(true);
    const stored =
      selectText(`select lease_token::text from platform_private.jobs
      where id = '${request.claimedJob.jobId}'`);
    expectSafeEqual(
      stored,
      request.claimedJob.leaseToken,
      'stored token matches the actual receipt token',
    );
    expect(
      token !== request.claimedJob.leaseToken && token !== stored,
      'max UUID differs from both actual token witnesses',
    ).toBe(true);
    refusal(await resolveClaim(input), 'CONFLICT');
  });

  it('rejects schemaVersion string one as INVALID_REQUEST', async () => {
    const input = {
      ...request,
      requestedEvent: { ...request.requestedEvent, schemaVersion: '1' },
    };
    expect(
      CmsSchemaDryRunClaimRequestSchema.safeParse(input).success,
      'private request rejects the string scalar',
    ).toBe(false);
    refusal(await resolveClaim(input), 'INVALID_REQUEST');
  });

  it('accepts raw wire schemaVersion numeric 1.0 with the full stored projection', async () => {
    // accepted independently checks all six members against SELECT projections.
    const baseline = await accepted(attempt, request);
    const rpcBody = { p_request: request };
    const normal = JSON.stringify(rpcBody);
    let replacements = 0;
    const wire = normal.replace(/"schemaVersion":1(?=[,}])/gu, () => {
      replacements += 1;
      return '"schemaVersion":1.0';
    });
    expect(replacements, 'exactly one schemaVersion lexeme replaced').toBe(1);
    expect(wire !== normal, 'wire bytes differ from normal serialization').toBe(
      true,
    );
    expect(
      wire.match(/"schemaVersion":1\.0(?=[,}])/gu)?.length,
      'wire retains exactly one numeric 1.0 lexeme',
    ).toBe(1);
    const decoded: unknown = JSON.parse(wire);
    expectSafeEqual(decoded, rpcBody, 'wire body preserves the parsed request');
    const response = await observeRead(async () => {
      try {
        const transport = await fetch(
          `${API_URL}/rest/v1/rpc/cms_get_schema_migration_plan`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${tokenFor('service_role')}`,
              'accept-profile': 'platform_api',
              'content-profile': 'platform_api',
              'content-type': 'application/json',
            },
            body: wire,
          },
        );
        const body: unknown = await transport.json();
        return { status: transport.status, body };
      } catch {
        throw new Error('Raw numeric resolver transport or JSON failed');
      }
    });
    expect(response.status, 'raw numeric resolver status').toBe(200);
    const parsed = CmsSchemaDryRunClaimResponseSchema.safeParse(response.body);
    expect(parsed.success, 'raw numeric response matches strict schema').toBe(
      true,
    );
    if (!parsed.success) throw new Error('Raw numeric resolver output invalid');
    expectSafeEqual(
      response.body,
      baseline,
      'raw full response matches baseline',
    );
    expectSafeEqual(
      parsed.data,
      baseline,
      'parsed full response matches baseline',
    );
  });

  it('retains legacy eighteen-digit stale expectedVersion semantic CONFLICT', async () => {
    const current = legacyRequest(attempt);
    const expectedVersion = '999999999999999999';
    expect(
      expectedVersion !== current.expectedVersion,
      'legacy eighteen-digit value differs from stored version',
    ).toBe(true);
    refusal(await resolveClaim({ ...current, expectedVersion }), 'CONFLICT');
  });

  it('retains legacy nineteen-digit expectedVersion INVALID_REQUEST', async () => {
    const current = legacyRequest(attempt);
    refusal(
      await resolveClaim({
        ...current,
        expectedVersion: '1000000000000000000',
      }),
      'INVALID_REQUEST',
    );
  });
});

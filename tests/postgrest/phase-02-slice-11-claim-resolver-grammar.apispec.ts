/** Genuine syntax-versus-binding probes; no preparation or activation worker. */
import { randomUUID } from 'node:crypto';

import { CmsUuidSchema } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  CmsSchemaDryRunClaimRequestSchema,
  type CmsSchemaDryRunClaimRequest,
} from '../../apps/worker/src/content-schema-registry/schema-dry-run-claim-request';
import { expectSafeEqual } from './support/phase-02-slice-11-assert';
import {
  claimAttempt,
  originalEvent,
  prepareClaimAttempt,
  record,
  resolveClaim,
  selectText,
  type ClaimAttempt,
} from './support/phase-02-slice-11-claimed-dry-run-fixture';
import {
  accepted,
  refusal,
} from './support/phase-02-slice-11-claimed-dry-run-oracles';
import { callRpc, tokenFor } from './support/stack';

let attempt: ClaimAttempt;
let request: CmsSchemaDryRunClaimRequest;

beforeAll(async () => {
  attempt = await prepareClaimAttempt();
  request = await claimAttempt(attempt);
});

// The normal helper is frozen. Only this genuine claim supplies a chosen UUID
// spelling; its version comes from the returned receipt, never event arithmetic.
const claimWithToken = async (candidate: ClaimAttempt, leaseToken: string) => {
  expect(CmsUuidSchema.safeParse(leaseToken).success, 'valid claim UUID').toBe(
    true,
  );
  const response = await callRpc('claim_job', tokenFor('service_role'), {
    p_job_id: candidate.report.jobId,
    p_expected_version: candidate.preclaimVersion,
    p_lease_token: leaseToken,
    p_lease_seconds: 840,
  });
  expect(response.status, 'protected BE00 token claim status').toBe(200);
  if (!Array.isArray(response.body) || response.body.length !== 1)
    throw new Error('Protected BE00 token claim must return one row');
  const receipt = record(response.body[0]);
  expectSafeEqual(
    [receipt.job_id, receipt.state],
    [candidate.report.jobId, 'running'],
    'protected BE00 token claim receipt',
  );
  const version =
    typeof receipt.version === 'number' && Number.isSafeInteger(receipt.version)
      ? String(receipt.version)
      : receipt.version;
  const parsed = CmsSchemaDryRunClaimRequestSchema.safeParse({
    claimedJob: { jobId: receipt.job_id, version, leaseToken },
    requestedEvent: candidate.event,
  });
  if (!parsed.success) throw new Error('Actual token claim request is invalid');
  expectSafeEqual(
    parsed.data.claimedJob.leaseToken,
    leaseToken,
    'request preserves supplied UUID spelling',
  );
  expectSafeEqual(
    originalEvent(candidate.report.jobId),
    candidate.event,
    'token claim preserves all original event fields',
  );
  expectSafeEqual(
    selectText(`select lease_token::text from platform_private.jobs
      where id = '${candidate.report.jobId}'`),
    leaseToken.toLowerCase(),
    'actual job stores the claimed UUID value',
  );
  return parsed.data;
};

const VALID_FULL_WIDTH_VERSIONS = [
  { label: 'smallest nineteen-digit version', value: '1000000000000000000' },
  { label: 'nineteen-digit interior version', value: '9007199254740993000' },
  { label: 'signed bigint maximum', value: '9223372036854775807' },
] as const;
const INVALID_VERSIONS = [
  { label: 'above signed bigint maximum', value: '9223372036854775808' },
  { label: 'twenty digits', value: '10000000000000000000' },
  { label: 'leading zero', value: '0100000000000000000' },
  { label: 'zero', value: '0' },
  { label: 'fraction', value: '1.5' },
  { label: 'scientific notation', value: '1e3' },
  { label: 'plus sign', value: '+1' },
  { label: 'minus sign', value: '-1' },
  { label: 'leading whitespace', value: ' 1' },
  { label: 'trailing whitespace', value: '1 ' },
  { label: 'empty string', value: '' },
  { label: 'JSON number', value: 2 },
  { label: 'JSON null', value: null },
  { label: 'JSON boolean', value: true },
  { label: 'JSON array', value: [] },
  { label: 'JSON object', value: {} },
] as const;

describe('genuine claimed dry-run resolver grammar', () => {
  it.each(VALID_FULL_WIDTH_VERSIONS)(
    'returns semantic CONFLICT for valid stale $label rather than INVALID_REQUEST',
    async ({ value }) => {
      const input = {
        ...request,
        claimedJob: { ...request.claimedJob, version: value },
      };
      expect(
        CmsSchemaDryRunClaimRequestSchema.safeParse(input).success,
        'full-width request is syntactically valid',
      ).toBe(true);
      expect(
        value !== request.claimedJob.version,
        'full-width version differs from actual receipt',
      ).toBe(true);
      refusal(await resolveClaim(input), 'CONFLICT');
    },
  );

  it.each(INVALID_VERSIONS)(
    'returns INVALID_REQUEST for claimed version with $label',
    async ({ value }) => {
      const input = {
        ...request,
        claimedJob: { ...request.claimedJob, version: value },
      };
      expect(
        CmsSchemaDryRunClaimRequestSchema.safeParse(input).success,
        'malformed version request is syntactically invalid',
      ).toBe(false);
      refusal(await resolveClaim(input), 'INVALID_REQUEST');
    },
  );

  it('resolves an actual UUIDv7 BE00 lease with the full stored projection', async () => {
    const candidate = await prepareClaimAttempt(attempt.owner);
    const generated = randomUUID();
    const token = `${generated.slice(0, 14)}7${generated.slice(15)}`;
    const claimed = await claimWithToken(candidate, token);
    await accepted(candidate, claimed);
  });

  it('resolves an actual uppercase UUID BE00 lease without changing the original Queue event', async () => {
    const candidate = await prepareClaimAttempt(attempt.owner);
    const generated = Array.from({ length: 8 }, () => randomUUID()).find(
      (value) => /[a-f]/u.test(value),
    );
    if (generated === undefined)
      throw new Error('Uppercase UUID fixture requires a hexadecimal letter');
    const token = generated.toUpperCase();
    expect(token !== token.toLowerCase(), 'uppercase spelling differs').toBe(
      true,
    );
    const claimed = await claimWithToken(candidate, token);
    await accepted(candidate, claimed);
  });

  it('returns semantic CONFLICT for a syntactically valid nil wrong-token request', async () => {
    const input = {
      ...request,
      claimedJob: {
        ...request.claimedJob,
        leaseToken: '00000000-0000-0000-0000-000000000000',
      },
    };
    expect(
      CmsSchemaDryRunClaimRequestSchema.safeParse(input).success,
      'nil UUID remains valid request syntax',
    ).toBe(true);
    expect(
      input.claimedJob.leaseToken !== request.claimedJob.leaseToken,
      'nil UUID differs from the actual live claim',
    ).toBe(true);
    refusal(await resolveClaim(input), 'CONFLICT');
  });
});

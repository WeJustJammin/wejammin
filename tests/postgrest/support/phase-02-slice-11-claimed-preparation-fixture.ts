/** Genuine protected RPC transport; records evidence without replacing replies. */
import { randomUUID } from 'node:crypto';

import type {
  JobEffectInput,
  JobLeaseClaimRequest,
} from '@wejammin/application';
import { expect } from 'vitest';

import {
  parseCanonicalJob,
  parseLease,
} from '../../../apps/worker/src/async-runtime-parsing';
import { createSupabaseRpc } from '../../../apps/worker/src/async-runtime-support';
import { createClaimedSchemaMigrationPreparation } from '../../../apps/worker/src/content-schema-registry/claimed-schema-migration-preparation';
import {
  SCHEMA_MIGRATION_RPC,
  type SchemaMigrationRpcName,
} from '../../../apps/worker/src/content-schema-registry/migration-worker-constants';
import type { MigrationWorkerPort } from '../../../apps/worker/src/content-schema-registry/migration-worker-types';
import {
  observeRead,
  prepareClaimAttempt,
  record,
} from './phase-02-slice-11-claimed-dry-run-fixture';
import { s11Environment } from './phase-02-slice-11-session';

export type PreparationCall = {
  operation: SchemaMigrationRpcName;
  request: unknown;
  signal: AbortSignal;
  response?: unknown;
};

export type PreparationWire = Readonly<{
  operation: string;
  body: Record<string, unknown>;
  status: number;
  profile: string | null;
  acceptProfile: string | null;
}>;

export const prepareClaimedPreparationFixture = async () => {
  const attempt = await prepareClaimAttempt();
  const environment = s11Environment();
  const signal = new AbortController().signal;
  const setupRpc = createSupabaseRpc(globalThis.fetch);
  const job = parseCanonicalJob(
    await observeRead(() =>
      setupRpc(
        environment,
        'read_canonical_job',
        { p_job_id: attempt.report.jobId },
        signal,
      ),
    ),
  );
  if (job === null) throw new Error('Genuine preclaim job is invalid');
  expect(job).toStrictEqual({
    id: attempt.report.jobId,
    type: 'cms.schema.dry_run',
    state: 'queued',
    version: attempt.preclaimVersion,
    leaseUntilMs: null,
  });
  const claim: JobLeaseClaimRequest = {
    jobId: job.id,
    expectedVersion: job.version,
    leaseToken: randomUUID(),
    leaseSeconds: 840,
    nowMs: Date.now(),
  };
  const rawLease = await setupRpc(
    environment,
    'claim_job',
    {
      p_job_id: claim.jobId,
      p_expected_version: claim.expectedVersion,
      p_lease_token: claim.leaseToken,
      p_lease_seconds: claim.leaseSeconds,
    },
    signal,
  );
  const claimedLease = parseLease(rawLease, claim);
  const input = {
    job,
    envelope: attempt.event,
    leaseToken: claim.leaseToken,
    claimedLease,
  } satisfies JobEffectInput;

  const calls: PreparationCall[] = [];
  const wire: PreparationWire[] = [];
  const recordingFetch: typeof fetch = async (resource, init) => {
    const url = new URL(
      resource instanceof Request ? resource.url : String(resource),
    );
    if (
      !url.pathname.startsWith('/rest/v1/rpc/') ||
      typeof init?.body !== 'string'
    )
      throw new Error('Preparation transport expected an RPC JSON request');
    const body: unknown = JSON.parse(init.body);
    const plainBody = record(body);
    const headers = new Headers(init.headers);
    const profile = headers.get('content-profile');
    const acceptProfile = headers.get('accept-profile');
    const response = await globalThis.fetch(resource, init);
    wire.push({
      operation: url.pathname.slice('/rest/v1/rpc/'.length),
      body: plainBody,
      status: response.status,
      profile,
      acceptProfile,
    });
    return response;
  };
  const stageRpc = createSupabaseRpc(recordingFetch);
  const port: MigrationWorkerPort = {
    call: async (operation, request, originalSignal) => {
      const entry: PreparationCall = {
        operation,
        request,
        signal: originalSignal,
      };
      calls.push(entry);
      const invoke = () =>
        stageRpc(
          environment,
          operation,
          { p_request: request },
          originalSignal,
        );
      const response =
        operation === SCHEMA_MIGRATION_RPC.readPlan
          ? await observeRead(invoke)
          : await invoke();
      entry.response = response;
      return response;
    },
  };
  const worker = createClaimedSchemaMigrationPreparation({
    port,
    workerId: 's11-claimed-preparation',
    leaseDurationMs: 30_000,
    maxBatchRows: 128,
    maxBatchesPerInvocation: 1,
  });
  return { attempt, input, signal, worker, calls, wire };
};

/** Production Worker functions + unchanged RPC bodies, forwarded to the explicit ALT API. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type { JobEffectInput, JobEffectResult } from '@wejammin/application';
import type { QueueEnvelope } from '@wejammin/contracts';

import type { AsyncWorkerBindings } from '../../../apps/worker/src/async-entrypoint';
import { createJobPersistence } from '../../../apps/worker/src/async-runtime-parsing';
import { createSupabaseRpc } from '../../../apps/worker/src/async-runtime-rpc-transport';
import { createProductionCmsTaxonomyDependencies } from '../../../apps/worker/src/cms-composition-production-taxonomy';
import { createCmsTaxonomyApp } from '../../../apps/worker/src/cms-composition/taxonomy-routes';
import { createTaxonomyMergeConvergeEffect } from '../../../apps/worker/src/cms-taxonomy-merge-converge-effect';
import { runProductionCmsTaxonomyMergeReconcileSweep } from '../../../apps/worker/src/cms-taxonomy-merge-reconcile-sweep';

import {
  sql,
  type Dec194AltStack,
  type IsolationWorld,
} from './phase-02-slice-12-dec194-alt-stack';
import { createDec194IsolationOwner } from './phase-02-slice-12-dec194-lifecycle';
import type {
  CanonicalJobSnapshot,
  Producer,
  RpcTrace,
} from './phase-02-slice-12-dec194-worker-types';

export type { Producer, RpcTrace };
const ORIGIN = 'https://app.example.test';
const TYPE = 'cms.taxonomy.merge_converge';
const OPERATIONS = new Set([
  'cms_act_taxonomy_term',
  'cms_run_taxonomy_merge_converge',
  'cms_reconcile_taxonomy_merge_converge',
  'read_canonical_job',
  'claim_job',
  'apply_job_outcome',
]);

export const createDec194IsolationWorker = (
  stack: Dec194AltStack,
  world: IsolationWorld,
) => {
  const originalFetch = globalThis.fetch;
  const realFetch = originalFetch.bind(globalThis);
  const owner = createDec194IsolationOwner();
  const traces: RpcTrace[] = [];
  const environment = {
    APP_ENVIRONMENT: 'development',
    APP_RELEASE: 'dec194-local-isolation-proof',
    SUPABASE_URL: stack.api,
    SUPABASE_SECRET_KEY: stack.secret,
  } as unknown as AsyncWorkerBindings;

  const forwardingFetch = (producer: Producer | null): typeof fetch =>
    (async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(
        url.origin,
        stack.api,
        'never forward to a default/hosted API',
      );
      assert.equal(url.search, '');
      const operation = url.pathname.replace('/rest/v1/rpc/', '');
      assert.equal(url.pathname, `/rest/v1/rpc/${operation}`);
      assert.ok(OPERATIONS.has(operation), 'allowlisted production RPC only');
      assert.equal(init?.method, 'POST');
      const headers = new Headers(init?.headers);
      const opaqueApikeyOnly =
        headers.get('apikey') === stack.secret && !headers.has('authorization');
      const platformProfile =
        headers.get('content-profile') === 'platform_api' &&
        headers.get('accept-profile') === 'platform_api';
      assert.ok(
        opaqueApikeyOnly && platformProfile,
        'unchanged production credential/profile headers',
      );
      if (producer !== null) {
        headers.set('x-s12-dec194-probe', stack.nonce);
        headers.set('x-s12-dec194-producer', producer);
        if (stack.nonRcExpected !== undefined)
          headers.set('x-s12-dec194-expect-non-rc', stack.nonRcExpected);
      }
      // Only observational headers are added. Body, signal, response and errors are not replaced.
      return owner.request(init?.signal, async (signal) => {
        const response = await realFetch(input, { ...init, headers, signal });
        let answer: unknown = null;
        try {
          answer = await response.clone().json();
        } catch {
          /* preserved non-JSON response */
        }
        traces.push({
          operation,
          producer,
          status: response.status,
          request: JSON.parse(String(init?.body)),
          response: answer,
          opaqueApikeyOnly,
          platformProfile,
          abortable: init?.signal instanceof AbortSignal,
        });
        return response;
      });
    }) as typeof fetch;

  const persistence = createJobPersistence(
    environment,
    createSupabaseRpc(forwardingFetch(null)),
  );
  const checkCanonicalUpstream = async (): Promise<void> => {
    const canonical = await persistence.readCanonicalJob(world.upstreamJobId);
    assert.ok(canonical, 'fresh fixture sentinel visible through the real API');
    owner.admit();
    const actual = stack.json<CanonicalJobSnapshot>(`
      select jsonb_build_object('id', id, 'type', job_type, 'state', state,
        'version', version::text) from platform_private.jobs
        where id = ${sql(world.upstreamJobId)}::uuid;`);
    assert.deepEqual(
      {
        id: canonical.id,
        type: canonical.type,
        state: canonical.state,
        version: canonical.version,
      },
      actual,
      'real API and explicit ALT SQL must see the same unique canonical job',
    );
    assert.equal(canonical.state, 'cancelled');
  };

  const ordinary = async (): Promise<Response> => {
    const sessionId = randomUUID();
    const app = createCmsTaxonomyApp(
      createProductionCmsTaxonomyDependencies({
        environment,
        fetchImpl: forwardingFetch('ordinary'),
        humanOrigins: [ORIGIN],
        // Verified-session and quota seams only; the production context resolver
        // re-resolves this same identity, and SQL re-proves its persisted authority.
        auth: {
          resolveSession: async () => ({
            ok: true as const,
            value: {
              authUserId: world.authUserId,
              personId: world.personId,
              actingPartyId: world.partyId,
              actingContextId: world.bindingId,
              sessionId,
              accountState: 'active' as const,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
              stepUpAt: null,
            },
          }),
        },
        resolveCapabilities: ['cms.taxonomy_curator'],
        rateLimit: async (input) => ({
          ok: true as const,
          value: {
            allowed: true,
            limit: input.limit,
            remaining: input.limit - 1,
            resetAt: Math.floor(Date.now() / 1000) + 60,
          },
        }),
      }),
    );
    return app.request(
      `${ORIGIN}/api/v1/cms/taxonomies/${world.taxonomyId}/terms/actions`,
      {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          'content-type': 'application/json',
          'idempotency-key': `dec194-rpc-${stack.nonce}`,
          'if-match': `"${world.expectedVersion}"`,
          'x-request-id': randomUUID(),
        },
        body: JSON.stringify({
          taxonomyId: world.taxonomyId,
          action: 'merge',
          termKey: world.sourceKey,
          parentId: null,
          survivorId: world.survivorId,
          labels: [{ locale: 'en-US', label: 'Label iso-source' }],
          aliases: [],
          expectedVersion: world.expectedVersion,
        }),
      },
    );
  };

  const claim = async (jobId: string): Promise<JobEffectInput> => {
    const job = await persistence.readCanonicalJob(jobId);
    assert.ok(
      job && job.state === 'queued',
      'claim starts from a real queued canonical job',
    );
    const leaseToken = randomUUID();
    const claimedLease = await persistence.claimJobLease({
      jobId,
      leaseToken,
      expectedVersion: job.version,
      leaseSeconds: 300,
      nowMs: Date.now(),
    });
    assert.ok(claimedLease, 'real BE00 HTTP claim receipt required');
    owner.admit();
    const envelope = stack.json<QueueEnvelope>(`
      select jsonb_build_object('aggregateId', e.aggregate_id, 'aggregateType', e.aggregate_type,
        'aggregateVersion', e.aggregate_version::text, 'causationId', null,
        'correlationId', e.correlation_id, 'eventId', e.id, 'eventType', e.event_type,
        'schemaVersion', e.schema_version)
      from platform_private.jobs j join platform_private.outbox_events e on e.id = j.originating_event_id
      where j.id = ${sql(jobId)}::uuid;`);
    return { job, envelope, leaseToken, claimedLease };
  };
  const continuation = (input: JobEffectInput): Promise<JobEffectResult> =>
    createTaxonomyMergeConvergeEffect(forwardingFetch('continuation'))(input, {
      env: environment,
      signal: owner.signal,
      deliveryAttempt: 1,
    });
  const settle = async (
    input: JobEffectInput,
    state: 'succeeded' | 'failed',
    resultRef: unknown,
  ): Promise<void> => {
    assert.ok(input.claimedLease);
    assert.equal(
      await persistence.applyJobOutcome({
        jobId: input.job.id,
        leaseToken: input.leaseToken,
        currentState: 'running',
        nextState: state,
        expectedVersion: input.claimedLease.version,
        currentVersion: input.claimedLease.version,
        nextVersion: (BigInt(input.claimedLease.version) + 1n).toString(),
        retryable: false,
        resultRef,
        errorCode: state === 'failed' ? 'S12_ISOLATION_FIXTURE_FAILURE' : null,
      }),
      true,
      'real BE00 HTTP terminal outcome',
    );
  };
  const recoveryFetch = forwardingFetch('recovery');
  let recoveries = 0;
  let recoveryOwnershipError: Error | undefined;
  const lostRecoveryOwnership = (): Error => {
    recoveryOwnershipError ??= new Error(
      'DEC194 recovery fetch ownership changed; foreign override preserved.',
    );
    void owner.close();
    return recoveryOwnershipError;
  };
  const recovery = async (): Promise<void> => {
    if (recoveryOwnershipError !== undefined) throw recoveryOwnershipError;
    const expected = recoveries === 0 ? originalFetch : recoveryFetch;
    if (globalThis.fetch !== expected) throw lostRecoveryOwnership();
    if (recoveries === 0) globalThis.fetch = recoveryFetch;
    recoveries += 1;
    try {
      await runProductionCmsTaxonomyMergeReconcileSweep(environment);
    } finally {
      recoveries -= 1;
      if (globalThis.fetch !== recoveryFetch) lostRecoveryOwnership();
      else if (recoveries === 0) globalThis.fetch = originalFetch;
    }
    if (recoveryOwnershipError !== undefined) throw recoveryOwnershipError;
  };
  const close = async (): Promise<void> => {
    await owner.close();
    if (recoveryOwnershipError !== undefined) throw recoveryOwnershipError;
  };
  return {
    traces,
    type: TYPE,
    close,
    checkCanonicalUpstream: () => owner.run(checkCanonicalUpstream),
    ordinary: () => owner.run(ordinary),
    claim: (jobId: string) => owner.run(() => claim(jobId)),
    continuation: (input: JobEffectInput) =>
      owner.run(() => continuation(input)),
    settle: (
      input: JobEffectInput,
      state: 'succeeded' | 'failed',
      resultRef: unknown,
    ) => owner.run(() => settle(input, state, resultRef)),
    recovery: () => owner.run(recovery),
    readCanonical: (jobId: string) =>
      owner.run(() => persistence.readCanonicalJob(jobId)),
  };
};

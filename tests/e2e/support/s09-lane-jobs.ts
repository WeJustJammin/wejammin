import type { JobStatusDependencies } from '../../../apps/worker/src/jobs/job-status-types';

import { fixtureHash } from './s09-lane-hash';
import { verifyLaneBearer } from './s09-lane-auth';
import { LANE_ACTING_PARTY_ID, laneUserId } from './s09-lane-ids';
import { iso, worldForId } from './s09-lane-world';

/**
 * BE00 job status for the dry-run job, advanced by READS the way the queue
 * would advance it by time: the first read observes `queued`, the second
 * `running`, the third `succeeded` and seals the dry-run report (counts and
 * hashes), so the browser's one-second poll shows each state exactly once.
 */
const SEALED_ROWS = 48;

export const laneJobs: Pick<
  JobStatusDependencies,
  'resolvePrincipal' | 'loadJobStatus' | 'rateLimit'
> = {
  resolvePrincipal: async (request) => {
    const claim = await verifyLaneBearer(request);
    return claim === null
      ? { kind: 'anonymous' }
      : { kind: 'user', userId: claim.userId };
  },
  loadJobStatus: ({ jobId }) => {
    const world = worldForId(jobId);
    const job = world?.jobs.find((entry) => entry.id === jobId);
    const run = world?.dryRuns.find((entry) => entry.id === job?.dryRunId);
    if (world === null || job === undefined || run === undefined) return null;
    job.reads += 1;
    const state =
      job.reads === 1 ? 'queued' : job.reads === 2 ? 'running' : 'succeeded';
    const now = iso(Date.now());
    run.updatedAt = now;
    if (state === 'running') run.state = 'running';
    if (state === 'succeeded' && run.state !== 'completed') {
      run.state = 'completed';
      run.result = 'passed';
      run.sourceCount = SEALED_ROWS;
      run.targetCount = SEALED_ROWS;
      run.rowErrorCount = 0;
      run.sourceHash = fixtureHash(`source:${run.id}`);
      run.targetHash = fixtureHash(`target:${run.id}`);
      run.reportHash = fixtureHash(`report:${run.id}`);
      run.version += 1;
    }
    return {
      actorId: laneUserId(job.actor),
      actingPartyId: LANE_ACTING_PARTY_ID,
      etag: `"${String(job.reads)}"`,
      data: {
        id: job.id,
        type: 'schema_dry_run',
        state,
        progress:
          state === 'succeeded'
            ? { completed: SEALED_ROWS, total: SEALED_ROWS, unit: 'rows' }
            : null,
        resultRef:
          state === 'succeeded' ? { type: 'schema_dry_run', id: run.id } : null,
        error: null,
        createdAt: job.createdAt,
        updatedAt: now,
      },
    };
  },
  rateLimit: () => ({
    allowed: true,
    limit: 300,
    remaining: 299,
    resetAt: 2_000_000_000,
    scope: 'user',
  }),
};

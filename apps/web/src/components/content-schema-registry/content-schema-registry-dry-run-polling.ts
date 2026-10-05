import * as React from 'react';
import type { JobState } from '@wejammin/contracts';

import { createJobStatusReader } from '../../lib/infrastructure-jobs';
import { useJobPolling } from '../infrastructure/jobs/useJobPolling';
import type { JobStatusReader } from '../infrastructure/jobs/useJobPolling';
import type { SchemaActivationPreparation } from './content-schema-registry-types';

const TERMINAL: readonly JobState[] = ['succeeded', 'failed', 'cancelled'];

const isTerminal = (state: JobState): boolean => TERMINAL.includes(state);

/** The BE00 job a still-unsealed dry run is observed through, if any. */
export const pollableJobId = (
  preparation: SchemaActivationPreparation,
): string | null => {
  const dryRun = preparation.dryRunRef;
  if (
    dryRun === null ||
    (dryRun.state !== 'queued' && dryRun.state !== 'running')
  )
    return null;
  const job = preparation.jobRef;
  if (job !== null && isTerminal(job.state)) return null;
  return job?.id ?? dryRun.jobId;
};

const readerFor = (jobId: string | null): JobStatusReader | null => {
  if (jobId === null) return null;
  try {
    return createJobStatusReader(jobId);
  } catch {
    return null;
  }
};

const unavailableReader: JobStatusReader = () =>
  Promise.reject(new Error('No dry-run job is available for this view'));

/**
 * Observe one dry-run job through the BE00 job status resource with the FE00
 * polling defaults (1 s interval, safe-read retry 250/750 ms, 8 s deadline).
 * It never invents a result: a terminal job only asks the owner of canonical
 * state to refetch the detail so the sealed report is read from the server.
 */
export interface ContentSchemaRegistryDryRunPolling {
  /** Last job state read through BE00, or null before any read succeeds. */
  readonly job: JobState | null;
  /** A failed job read; retryable only when the read failure is retryable. */
  readonly failure: { readonly retryable: boolean } | null;
  readonly retry: () => void;
}

export const useContentSchemaRegistryDryRunPolling = (input: {
  readonly jobId: string | null;
  readonly onTerminal: () => void;
}): ContentSchemaRegistryDryRunPolling => {
  const { jobId, onTerminal } = input;
  const reader = React.useMemo(() => readerFor(jobId), [jobId]);
  const polling = useJobPolling({
    read: reader ?? unavailableReader,
    enabled: reader !== null,
    safeRetryDeclared: true,
    ...(jobId === null ? {} : { expectedJobId: jobId }),
  });
  const polled =
    polling.state.status === 'success' ? polling.state.data.state : null;
  const notified = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (polled === null || !isTerminal(polled) || jobId === null) return;
    const key = `${jobId}:${polled}`;
    if (notified.current === key) return;
    notified.current = key;
    onTerminal();
  }, [jobId, polled, onTerminal]);
  return {
    job: reader === null ? null : polled,
    failure:
      reader !== null && polling.state.status === 'error'
        ? { retryable: polling.state.retryable }
        : null,
    retry: polling.start,
  };
};

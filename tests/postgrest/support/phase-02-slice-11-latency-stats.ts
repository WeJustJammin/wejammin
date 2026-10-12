/**
 * Timing helpers of the composed Slice 11 read-latency measurement.
 *
 * `percentile` is PostgreSQL's `percentile_cont` (linear interpolation at `p * (n - 1)`), the estimator the SQL benches
 * (`phase_02_slice_09_evidence_bench128.sql`, `phase_02_slice_11_reads_bench128.sql`) use, so a figure measured here and a
 * figure measured there are the same statistic over different distances.
 */
import { appendFileSync } from 'node:fs';
import { loadavg } from 'node:os';

export const percentile = (samples: readonly number[], p: number): number => {
  if (samples.length === 0) throw new Error('a percentile needs samples');
  const sorted = [...samples].sort((a, b) => a - b);
  const position = p * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] as number;
  const high = sorted[upper] as number;
  return low + (high - low) * (position - lower);
};

export type Measurement = Readonly<{
  op: string;
  /** Timed samples in milliseconds, in request order. */
  samples: readonly number[];
  /** The discarded warm-up requests (connection setup, first plan), in milliseconds. */
  warmups: readonly number[];
  p50: number;
  p95: number;
  max: number;
  loadBefore: number;
  loadAfter: number;
}>;

/**
 * Times `request` for `warmups` discarded plus `samples` counted calls, one at a time, and logs one summary line. Only the
 * request is inside the timed region: `check` judges each answer (status, shape) afterwards, so a timed error path or an
 * empty answer fails the measurement instead of passing it quickly.
 */
export const measure = async <Answer>(
  op: string,
  request: () => Promise<Answer>,
  check: (answer: Answer) => void,
  options: Readonly<{ samples: number; warmups: number }>,
): Promise<Measurement> => {
  const loadBefore = loadavg()[0] ?? 0;
  const warmups: number[] = [];
  const samples: number[] = [];
  for (let call = 0; call < options.warmups + options.samples; call += 1) {
    const started = performance.now();
    const answer = await request();
    const elapsed = performance.now() - started;
    check(answer);
    (call < options.warmups ? warmups : samples).push(elapsed);
  }
  const loadAfter = loadavg()[0] ?? 0;
  const result: Measurement = {
    op,
    samples,
    warmups,
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    max: Math.max(...samples),
    loadBefore,
    loadAfter,
  };
  const fixed = (value: number): string => value.toFixed(1);
  // A run that is being recorded names a JSON-lines file in S11_LATENCY_LOG; every measurement lands there with its raw
  // samples (the default reporter prints no console output for a passing file).
  const recordTo = process.env.S11_LATENCY_LOG;
  if (recordTo !== undefined && recordTo !== '')
    appendFileSync(
      recordTo,
      `${JSON.stringify({ at: new Date().toISOString(), ...result })}\n`,
    );
  console.info(
    `[s11-latency] ${op} n=${samples.length} p50=${fixed(result.p50)}ms p95=${fixed(result.p95)}ms ` +
      `max=${fixed(result.max)}ms warmup=${warmups.map(fixed).join('/')}ms load1=${loadBefore.toFixed(2)}->${loadAfter.toFixed(2)}`,
  );
  return result;
};

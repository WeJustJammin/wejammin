import { useCallback, useEffect, useRef, useState } from 'react';

import type { PatternFormStatus } from './CmsPatternStatus';
import type { PatternBuildResult } from './pattern-designer-request';
import { showSavedPatternAddress } from './pattern-designer-location';
import { refusalItems } from './pattern-designer-refusal-items';
import type {
  PatternCreatedFacts,
  PatternSubmitResult,
  submitPatternVersion,
} from './pattern-designer-submit';
import type { PatternLatestResult } from './pattern-latest-read';
import { reconcileUnknownOutcome } from './pattern-outcome-reconcile';
import type { EditableTree } from './pattern-tree-state';
import type {
  PatternBaseIdentity,
  usePatternConflict,
} from './use-pattern-conflict';

type PreparedPattern = Extract<PatternBuildResult, { ok: true }>;

interface PatternAttempt {
  readonly request: PreparedPattern['value'];
  readonly body: string;
  readonly key: string;
  readonly base: PatternBaseIdentity | null;
}

interface ReconcileJob {
  readonly attempt: PatternAttempt;
  readonly sequence: number;
  readonly resolve: (result: PatternLatestResult) => void;
}

interface Options {
  readonly conflict: Pick<
    ReturnType<typeof usePatternConflict>,
    'check' | 'clear' | 'waiting'
  >;
  readonly csrfToken: string;
  readonly submit: typeof submitPatternVersion;
  readonly setStatus: (status: PatternFormStatus) => void;
  readonly startRateWait: (seconds: number) => void;
}

/** One immutable command owns its automatic and manual canonical outcome checks. */
export const usePatternUnknownOutcome = ({
  conflict,
  csrfToken,
  submit,
  setStatus,
  startRateWait,
}: Options) => {
  const attemptRef = useRef<PatternAttempt | null>(null);
  const inFlightRef = useRef(false);
  const unresolvedRef = useRef(false);
  const mountedRef = useRef(false);
  const sequenceRef = useRef(0);
  const startedReadRef = useRef(0);
  const [unresolved, setUnresolved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [readJob, setReadJob] = useState<ReconcileJob | null>(null);
  const { check: read, clear, waiting } = conflict;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
    };
  }, []);

  const current = useCallback(
    (sequence: number): boolean =>
      mountedRef.current && sequenceRef.current === sequence,
    [],
  );

  const complete = useCallback(
    (resource: PatternCreatedFacts, sequence: number): void => {
      if (!current(sequence)) return;
      attemptRef.current = null;
      inFlightRef.current = false;
      unresolvedRef.current = false;
      setUnresolved(false);
      setChecking(false);
      clear();
      setStatus({ kind: 'created', resource });
      showSavedPatternAddress(resource.patternKey);
    },
    [clear, current, setStatus],
  );

  const reconcile = useCallback(
    async (
      attempt: PatternAttempt,
      sequence: number,
    ): Promise<PatternLatestResult> => {
      if (!current(sequence)) return { kind: 'unavailable' };
      const result = await read({
        patternKey: attempt.request.patternKey,
        base: attempt.base,
      });
      if (!current(sequence)) return { kind: 'unavailable' };
      setReadJob(null);
      const verdict = reconcileUnknownOutcome(attempt.request, result);
      if (verdict.kind === 'created') complete(verdict.resource, sequence);
      else {
        inFlightRef.current = false;
        setChecking(false);
        if (verdict.kind === 'not-saved') {
          unresolvedRef.current = false;
          setUnresolved(false);
          clear();
          setStatus({ kind: 'unsaved' });
        } else {
          setStatus({
            kind: 'result',
            result: { kind: 'uncertain' },
            items: [],
          });
        }
      }
      return result;
    },
    [clear, complete, current, read, setStatus],
  );

  // Effects run after the checking panel's empty polite region is committed.
  useEffect(() => {
    if (readJob === null || startedReadRef.current === readJob.sequence) return;
    startedReadRef.current = readJob.sequence;
    void reconcile(readJob.attempt, readJob.sequence).then(readJob.resolve);
  }, [readJob, reconcile]);

  const queueRead = useCallback(
    (
      attempt: PatternAttempt,
      sequence: number,
    ): Promise<PatternLatestResult> => {
      setChecking(true);
      return new Promise<PatternLatestResult>((resolve) => {
        setReadJob({ attempt, sequence, resolve });
      });
    },
    [],
  );

  const canSubmit = useCallback(
    (): boolean =>
      mountedRef.current && !inFlightRef.current && !unresolvedRef.current,
    [],
  );

  const send = useCallback(
    async ({
      prepared,
      base,
      tree,
    }: {
      readonly prepared: PreparedPattern;
      readonly base: PatternBaseIdentity | null;
      readonly tree: EditableTree;
    }): Promise<void> => {
      if (!canSubmit()) return;
      const attempt: PatternAttempt = {
        request: prepared.value,
        body: prepared.body,
        key:
          attemptRef.current?.body === prepared.body
            ? attemptRef.current.key
            : crypto.randomUUID(),
        base: base === null ? null : { ...base },
      };
      attemptRef.current = attempt;
      inFlightRef.current = true;
      const sequence = ++sequenceRef.current;
      setStatus({ kind: 'pending' });
      let result: PatternSubmitResult;
      try {
        result = await submit(attempt.request, csrfToken, attempt.key);
      } catch {
        result = { kind: 'uncertain' };
      }
      if (!current(sequence)) return;
      if (result.kind === 'uncertain') {
        unresolvedRef.current = true;
        setUnresolved(true);
        await queueRead(attempt, sequence);
        return;
      }
      attemptRef.current = null;
      inFlightRef.current = false;
      if (result.kind === 'created') complete(result.resource, sequence);
      else {
        if (
          result.kind === 'rejected' &&
          result.status === 429 &&
          result.retryAfterSeconds !== undefined
        )
          startRateWait(result.retryAfterSeconds);
        setStatus({
          kind: 'result',
          result,
          items: refusalItems(result, tree),
        });
      }
    },
    [
      canSubmit,
      complete,
      csrfToken,
      current,
      queueRead,
      setStatus,
      startRateWait,
      submit,
    ],
  );

  const check = useCallback(async (): Promise<PatternLatestResult> => {
    const attempt = attemptRef.current;
    if (!unresolvedRef.current || attempt === null) return read();
    if (!mountedRef.current || inFlightRef.current || waiting)
      return { kind: 'unavailable' };
    inFlightRef.current = true;
    setStatus({ kind: 'pending' });
    return queueRead(attempt, ++sequenceRef.current);
  }, [queueRead, read, setStatus, waiting]);

  /** Explicit adoption resolves the old attempt and starts a new request identity. */
  const resolve = useCallback((): void => {
    if (!mountedRef.current) return;
    sequenceRef.current += 1;
    attemptRef.current = null;
    inFlightRef.current = false;
    unresolvedRef.current = false;
    setUnresolved(false);
    setChecking(false);
  }, []);

  return { send, check, resolve, canSubmit, unresolved, checking };
};

import { useCallback, useRef, useState } from 'react';

import type { useLocaleSourceReview } from './use-locale-source-review';

/** The entry version and source the form is based on. */
export interface LocaleSourceBase {
  readonly version: string;
  readonly sourceRevisionId: string;
  readonly sourceHash: string;
}

type Review = ReturnType<typeof useLocaleSourceReview>;

type Verdict =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'moved' }
  | { readonly kind: 'newer_version'; readonly version: string }
  | { readonly kind: 'failed' }
  | { readonly kind: 'superseded' };

const isNewer = (version: string, than: string): boolean =>
  BigInt(version) > BigInt(than);

/**
 * The read after a save (FE03 1048 `commandState`): an unknown outcome "reconciles by refetching ... before any
 * retry" and a success refetches what the form shows, both by themselves (DEC-242 item 3). What the read sees is
 * only ever REPORTED after an unknown outcome: the retry is the identical request under its key and If-Match and
 * never adopts the version the read saw (DEC-244 3), so no second, different write can occur. After a confirmed
 * save a moved source is proposed for review (never adopted) and only a NEWER entry version of the same source is
 * taken for the next `If-Match`.
 */
export const useLocaleSaveReconcile = (
  review: Review,
  setVersion: (version: string) => void,
) => {
  // True from an unknown outcome until a read verified the entry; it holds every save, edited or not.
  const [unverified, setUnverified] = useState(false);
  // The verified read showed the entry or its source moved: the first write may have landed (reported, not adopted).
  const [entryMoved, setEntryMoved] = useState(false);
  const attempted = useRef<LocaleSourceBase | null>(null);
  const { read, hold, clear } = review;

  const verify = useCallback(
    async (
      expected: LocaleSourceBase,
      afterWrite: 'confirmed' | 'unknown',
    ): Promise<Verdict> => {
      const answer = await read();
      if (answer === null) return { kind: 'superseded' };
      if (answer.kind !== 'ready') return { kind: 'failed' };
      const { snapshot } = answer;
      const sourceSame =
        snapshot.sourceRevisionId === expected.sourceRevisionId &&
        snapshot.sourceHash === expected.sourceHash;
      // Nothing is proposed for adoption after an unknown outcome, so nothing stays read.
      if (afterWrite === 'unknown') {
        clear();
        return sourceSame && snapshot.version === expected.version
          ? { kind: 'unchanged' }
          : { kind: 'moved' };
      }
      if (!sourceSame) {
        hold();
        return { kind: 'moved' };
      }
      clear();
      return isNewer(snapshot.version, expected.version)
        ? { kind: 'newer_version', version: snapshot.version }
        : { kind: 'unchanged' };
    },
    [clear, hold, read],
  );

  /** After a confirmed save: refetch the source; adopt only a newer entry version of the same source. */
  const afterSaved = useCallback(
    async (saved: LocaleSourceBase): Promise<void> => {
      setEntryMoved(false);
      const verdict = await verify(saved, 'confirmed');
      if (verdict.kind === 'newer_version') setVersion(verdict.version);
    },
    [setVersion, verify],
  );

  /** After an unknown outcome (or the control that repeats a failed read): any verified read lifts the hold. */
  const afterUnknown = useCallback(
    async (
      base: LocaleSourceBase | null = attempted.current,
    ): Promise<void> => {
      if (base === null) return;
      attempted.current = base;
      setEntryMoved(false);
      setUnverified(true);
      const verdict = await verify(base, 'unknown');
      // Failed or superseded: the hold stays, the review panel states why and offers the read again.
      if (verdict.kind === 'unchanged' || verdict.kind === 'moved')
        setUnverified(false);
      if (verdict.kind === 'moved') setEntryMoved(true);
    },
    [verify],
  );

  /** An edit makes the next send a different request: the notice that promises the same one goes. */
  const dismissMoved = useCallback(() => setEntryMoved(false), []);

  return { unverified, entryMoved, afterSaved, afterUnknown, dismissMoved };
};

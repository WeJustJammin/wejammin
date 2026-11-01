import * as React from 'react';

/** The values a sent request carried, by field name. */
export type SentDraft = Readonly<Record<string, string>>;

/**
 * The late-edit rule of the governed command forms (FE03 1046 keeps the inputs editable while a command runs): the form
 * remembers what it SENT, and after a verified success clears only the fields that still hold it, so a value typed
 * meanwhile survives. `remember` is called when the request is sent, `commit` when it is verified.
 */
export const useSentDraft = () => {
  const sentRef = React.useRef<SentDraft>({});
  const [committed, setCommitted] = React.useState(0);
  const remember = React.useCallback((sent: SentDraft): void => {
    sentRef.current = sent;
  }, []);
  const commit = React.useCallback(
    (): void => setCommitted((count) => count + 1),
    [],
  );
  return { sentRef, committed, remember, commit };
};

/**
 * After each verified success: clear the typed fields that still hold what was sent. A value held outside the typed
 * fields (the chosen reviewer) is named by `extra.key` in what was sent and cleared through `extra.set` the same way;
 * `extra` must be stable (memoized by the caller).
 */
export const useClearSentOnCommit = (
  draft: ReturnType<typeof useSentDraft>,
  clearSent: (sent: SentDraft) => void,
  extra?: {
    readonly key: string;
    readonly set: (update: (current: string) => string) => void;
  },
): void => {
  const { sentRef, committed } = draft;
  React.useEffect(() => {
    if (committed === 0) return;
    const sent = sentRef.current;
    clearSent(sent);
    if (extra !== undefined)
      extra.set((current) => (current === sent[extra.key] ? '' : current));
  }, [clearSent, committed, extra, sentRef]);
};

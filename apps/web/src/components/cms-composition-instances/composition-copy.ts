/*
 * The fixed copy of every typed refusal of the composition page (FE03 1114, 1115, 1599, 1615, 1616; BE03c 1304). A
 * reason token of the operation's own list, or else the status, picks a sentence; no server text is ever shown.
 */
export type CompositionOperation = 'place' | 'update' | 'diff' | 'selector';

export const UNKNOWN_OUTCOME_MESSAGE =
  'The result is not known. Nothing is assumed. Send again to retry the same request safely, or reload the page to check.';

const REASONS: Readonly<
  Record<CompositionOperation, Readonly<Record<string, string>>>
> = {
  place: {
    revision_not_editable:
      "This entry's draft is no longer editable here. Your input is kept; reload the page to continue.",
    pattern_version_not_active:
      'This pattern version is no longer active. Choose another pattern; your input is kept.',
    pattern_incompatible:
      "This pattern is not compatible with this entry's content type. Choose another pattern.",
    nested_pattern_not_active:
      'A pattern nested inside this one is no longer active. Choose another pattern.',
    block_registry_digest_mismatch:
      'The block registry changed since this pattern was listed. Choose the pattern again; your input is kept.',
    pattern_cycle: 'This pattern would create a cycle and cannot be placed.',
    block_rules_violated:
      'This pattern breaks the composition rules of one of its blocks, so it cannot be placed. Choose another pattern; your input is kept.',
  },
  update: {
    diff_has_collisions:
      'The pattern changed again: this update now has collisions. The diff was reloaded and your choices on unchanged paths are kept.',
    revision_not_editable:
      "This entry's draft is no longer editable here. The diff was reloaded and your choices are kept.",
    pattern_version_not_active:
      'The newer pattern version is no longer active. Nothing was changed.',
    pattern_incompatible:
      "The newer pattern is not compatible with this entry's content type. Nothing was changed.",
    nested_pattern_not_active:
      'A pattern nested inside the newer version is no longer active. Nothing was changed.',
    block_rules_violated:
      'These choices would break the composition rules of a block (a child it does not allow, or too many blocks or levels). Nothing was applied and your choices are kept; change them and try again.',
  },
  diff: {
    diff_too_large:
      'This update is too large to compare here (more than 128 paths or 256 KiB). Nothing was changed.',
  },
  selector: {},
};

/**
 * The placement's digest refusal (BE03c 388, DEC-186) by what the selector read again found (DEC-246 ruling 5): the
 * values the author typed are kept in every case, and none of these sentences asks for a reload.
 */
export const registryChangedMessage = (
  outcome: 'read' | 'cleared' | 'unread',
): string => {
  const lead = 'The block registry changed since this pattern was listed.';
  if (outcome === 'read')
    return `${lead} The pattern list was read again and your input is kept; check it and place again.`;
  if (outcome === 'cleared')
    return `${lead} The pattern is no longer in the pattern list that was read again; choose another pattern. The rest of your input is kept.`;
  return `${lead} The pattern list could not be read again; place again to read it once more. Your input is kept.`;
};

const PLAIN_409: Readonly<Record<CompositionOperation, string>> = {
  place:
    'The entry changed since this page loaded. The page read its new version; check your input and place again.',
  update:
    'The entry or the instance changed since this page loaded. The page reloaded them; your choices are kept, so check them and try again.',
  diff: 'The update could not be read right now.',
  selector: 'The pattern list could not be read right now.',
};

const PLAIN_422: Readonly<Record<CompositionOperation, string>> = {
  place:
    'Check the fields marked below; the server did not accept the placement.',
  update:
    'These choices cannot form one consistent block tree. Nothing was applied and your choices are kept; change them and try again.',
  diff: 'The update could not be read right now.',
  selector: 'The pattern list could not be read right now.',
};

export const refusalMessage = (
  operation: CompositionOperation,
  status: number,
  reason: string | null,
): string => {
  const typed = reason === null ? undefined : REASONS[operation][reason];
  if (typed !== undefined) return typed;
  if (status === 401) return 'Your session ended. Sign in again to continue.';
  if (status === 403)
    return 'This account cannot edit the composition of this entry.';
  if (status === 404)
    return 'This entry or instance is not available to this account.';
  if (status === 409) return PLAIN_409[operation];
  if (status === 422) return PLAIN_422[operation];
  return operation === 'place' || operation === 'update'
    ? 'This request could not be completed. Nothing was changed.'
    : PLAIN_409[operation];
};

/** Page-level notes that are not an outcome: a state the person should read once. */
export const COMPOSITION_COPY = {
  noSession:
    'Your session token is missing, so patterns cannot be inserted or updated here. Sign in again to continue.',
  notEditable:
    "This entry's current revision is not an editable draft, so patterns cannot be inserted or updated here.",
} as const;

const RECONCILE_WORDS = {
  place: { moved: 'the placement', again: 'place twice' },
  update: { moved: 'the change', again: 'apply twice' },
} as const;

/**
 * What the entry read after an unknown outcome says (FE03 1050): still the version sent, moved on, or unreadable. The
 * read is only shown: the request, and so its `Idempotency-Key`, stays exactly as it was sent, so the retry can never
 * apply twice. `attempt` counts the checks of one unknown outcome (review V20 m5, DEC-246 ruling 3).
 */
export const reconciliationLine = (
  current: string | null,
  sent: string,
  kind: keyof typeof RECONCILE_WORDS,
  attempt = 1,
): string => {
  const words = RECONCILE_WORDS[kind];
  const retry = `Sending again retries the same request and cannot ${words.again}.`;
  // A repeated failed check names its attempt, so the sentence differs from the one before and is announced again.
  if (current === null)
    return `The entry could not be read to check${attempt > 1 ? ` (attempt ${attempt})` : ''}, so nothing more is known. Sending is off until it has been read: check again.`;
  return current === sent
    ? `The entry is still at version ${current}. ${retry}`
    : `The entry has moved to version ${current} since the request was sent, so ${words.moved} may have been applied. ${retry}`;
};

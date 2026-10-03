import {
  STEP_UP_DRAFT_KEY_PREFIX,
  currentStepUpContext,
  isStampLive,
  stampFor,
  type StepUpStateContext,
} from './step-up-binding';

export type DraftStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type StepUpDraft = Readonly<{
  values: Readonly<Record<string, string>>;
  idempotencyKey: string;
  expectedVersion: string | null;
}>;

const KEY_PREFIX = STEP_UP_DRAFT_KEY_PREFIX;
const FORBIDDEN_FIELD =
  /^(?:code|otp|totp|password|token)$|secret|otpauth|manualentry/iu;

const storageKey = (scope: string): string => `${KEY_PREFIX}${scope}`;

/**
 * True when a live draft saved under a scope that starts with `scopePrefix`
 * is waiting in this tab's storage. A draft that could never restore (another
 * session scope, or past the 600 s window) is purged instead of reported, so a
 * surface decides cheaply whether it must load its restore code and a stale
 * draft never survives.
 */
export const hasStepUpDraftWithPrefix = (
  storage: Pick<Storage, 'getItem' | 'key' | 'length' | 'removeItem'> | null,
  scopePrefix: string,
  context: StepUpStateContext = currentStepUpContext(),
): boolean => {
  if (storage === null) return false;
  try {
    const prefix = storageKey(scopePrefix);
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix) === true) keys.push(key);
    }
    let live = false;
    for (const key of keys) {
      if (readLive(storage, key, context) === null) storage.removeItem(key);
      else live = true;
    }
    return live;
  } catch {
    // Blocked storage holds no draft this tab could restore.
  }
  return false;
};

/**
 * Persists a protected form's draft before it navigates to `/step-up`.
 * Fields that could hold a one-time code or enrollment secret are never
 * written. Returns false when storage is unavailable.
 */
export const saveStepUpDraft = (
  storage: DraftStorage | null,
  scope: string,
  draft: StepUpDraft,
  context: StepUpStateContext = currentStepUpContext(),
): boolean => {
  if (storage === null) return false;
  const values = Object.fromEntries(
    Object.entries(draft.values).filter(
      ([name]) => !FORBIDDEN_FIELD.test(name),
    ),
  );
  try {
    storage.setItem(
      storageKey(scope),
      JSON.stringify({ ...draft, values, ...stampFor(context) }),
    );
    return true;
  } catch {
    return false;
  }
};

const isDraft = (value: unknown): value is StepUpDraft => {
  if (typeof value !== 'object' || value === null) return false;
  const { values, idempotencyKey, expectedVersion } = value as Record<
    string,
    unknown
  >;
  return (
    typeof values === 'object' &&
    values !== null &&
    !Array.isArray(values) &&
    Object.values(values).every((entry) => typeof entry === 'string') &&
    typeof idempotencyKey === 'string' &&
    (expectedVersion === null || typeof expectedVersion === 'string')
  );
};

/** Parses one stored draft; null unless it is well formed, same-scope and fresh. */
const readLive = (
  storage: Pick<Storage, 'getItem'>,
  key: string,
  context: StepUpStateContext,
): StepUpDraft | null => {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed) || !isStampLive(parsed, context)) return null;
    const { values, idempotencyKey, expectedVersion } = parsed;
    return { values, idempotencyKey, expectedVersion };
  } catch {
    return null;
  }
};

export const clearStepUpDraft = (
  storage: DraftStorage | null,
  scope: string,
): void => {
  try {
    storage?.removeItem(storageKey(scope));
  } catch {
    // Storage may be blocked; there is nothing to clear.
  }
};

/**
 * Reads and consumes the draft. Consuming it means a restored form shows the
 * values and waits for the person to confirm; nothing is replayed. A draft
 * written under another session scope, or older than the 600 s step-up window,
 * is cleared and never returned.
 */
export const loadStepUpDraft = (
  storage: DraftStorage | null,
  scope: string,
  context: StepUpStateContext = currentStepUpContext(),
): StepUpDraft | null => {
  if (storage === null) return null;
  try {
    const key = storageKey(scope);
    const draft = readLive(storage, key, context);
    storage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
};

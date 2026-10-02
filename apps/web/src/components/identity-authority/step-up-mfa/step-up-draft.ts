export type DraftStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type StepUpDraft = Readonly<{
  values: Readonly<Record<string, string>>;
  idempotencyKey: string;
  expectedVersion: string | null;
}>;

const KEY_PREFIX = 'wj-step-up-draft:';
const FORBIDDEN_FIELD =
  /^(?:code|otp|totp|password|token)$|secret|otpauth|manualentry/iu;

const storageKey = (scope: string): string => `${KEY_PREFIX}${scope}`;

/**
 * Persists a protected form's draft before it navigates to `/step-up`.
 * Fields that could hold a one-time code or enrollment secret are never
 * written. Returns false when storage is unavailable.
 */
export const saveStepUpDraft = (
  storage: DraftStorage | null,
  scope: string,
  draft: StepUpDraft,
): boolean => {
  if (storage === null) return false;
  const values = Object.fromEntries(
    Object.entries(draft.values).filter(
      ([name]) => !FORBIDDEN_FIELD.test(name),
    ),
  );
  try {
    storage.setItem(storageKey(scope), JSON.stringify({ ...draft, values }));
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
 * values and waits for the person to confirm; nothing is replayed.
 */
export const loadStepUpDraft = (
  storage: DraftStorage | null,
  scope: string,
): StepUpDraft | null => {
  if (storage === null) return null;
  try {
    const raw = storage.getItem(storageKey(scope));
    if (raw === null) return null;
    storage.removeItem(storageKey(scope));
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

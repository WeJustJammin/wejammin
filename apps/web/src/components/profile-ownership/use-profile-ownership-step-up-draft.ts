import * as React from 'react';

import {
  clearStepUpDraft,
  loadStepUpDraft,
  saveStepUpDraft,
  type DraftStorage,
} from '../identity-authority/step-up-mfa/step-up-draft';
import {
  newIdempotencyKey,
  type ProfileOwnershipOperation,
} from './profile-ownership-command-transport';

/**
 * FE00 error-per-class, 401 `STEP_UP_REQUIRED` (DEC-111): the interrupted form
 * persists its tab-scoped draft before it navigates to `/step-up`, and after
 * step-up it restores for an explicit re-confirmation. The draft is
 * session-scoped, cleared on return or re-confirmation and never replayed.
 *
 * Only the named editable, non-secret, non-identifying fields of an operation
 * are ever written; a one-time code, proof, route or person/party identifier
 * is not in any list here. An operation with no list persists nothing.
 */
const DRAFT_FIELDS: Readonly<
  Partial<Record<ProfileOwnershipOperation, readonly string[]>>
> = { 'PRF-API-08': ['reasonCode'] };

export const PROFILE_OWNERSHIP_STEP_UP_RESTORED =
  'Verification complete. Review and confirm to continue.';
/** The existing copy for state that moved; reused when the version differs. */
export const PROFILE_OWNERSHIP_STATE_CHANGED =
  'The ownership state changed. Refresh and retry.';

const storageOf = (): DraftStorage | null => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
};

const scopeOf = (operation: ProfileOwnershipOperation, action: string) =>
  `profile-ownership:${globalThis.location.pathname}:${operation}:${action}`;

const setNative = (element: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

export interface ProfileOwnershipStepUpDraft {
  readonly formRef: React.RefObject<HTMLFormElement | null>;
  /** The key for this submit: the interrupted one once, else a fresh key. */
  readonly keyForSubmit: () => string;
  /** Persist the draft, then the caller navigates. Never throws. */
  readonly persist: (form: HTMLFormElement, key: string) => void;
  /** Any outcome other than a step-up shortfall settles the form. */
  readonly settle: () => void;
}

export const useProfileOwnershipStepUpDraft = (input: {
  readonly operation: ProfileOwnershipOperation;
  readonly action: string;
  readonly expectedVersion: string;
  readonly onStatus: (message: string) => void;
}): ProfileOwnershipStepUpDraft => {
  const { operation, action, expectedVersion, onStatus } = input;
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const pinnedKey = React.useRef<string | null>(null);
  const fields = DRAFT_FIELDS[operation];

  React.useEffect(() => {
    const form = formRef.current;
    if (fields === undefined || form === null) return;
    const draft = loadStepUpDraft(storageOf(), scopeOf(operation, action));
    if (draft === null) return;
    for (const name of fields) {
      const value = draft.values[name];
      const element = form.elements.namedItem(name);
      if (value !== undefined && element instanceof HTMLInputElement)
        setNative(element, value);
    }
    if (draft.expectedVersion === expectedVersion) {
      pinnedKey.current = draft.idempotencyKey;
      onStatus(PROFILE_OWNERSHIP_STEP_UP_RESTORED);
      form.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
    } else {
      // The record moved while the person verified: their values stay, but the
      // interrupted command is not theirs to confirm any more.
      onStatus(PROFILE_OWNERSHIP_STATE_CHANGED);
    }
    // Mount only: a restored draft is consumed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    formRef,
    keyForSubmit: () => {
      const key = pinnedKey.current ?? newIdempotencyKey(operation);
      pinnedKey.current = null;
      return key;
    },
    persist: (form, key) => {
      if (fields === undefined) return;
      const data = new FormData(form);
      const values: Record<string, string> = {};
      for (const name of fields) {
        const value = data.get(name);
        if (typeof value === 'string' && value.length > 0) values[name] = value;
      }
      saveStepUpDraft(storageOf(), scopeOf(operation, action), {
        values,
        idempotencyKey: key,
        expectedVersion,
      });
    },
    settle: () => {
      clearStepUpDraft(storageOf(), scopeOf(operation, action));
    },
  };
};

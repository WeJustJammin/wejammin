import {
  clearStepUpDraft,
  loadStepUpDraft,
  saveStepUpDraft,
  type DraftStorage,
} from '../identity-authority/step-up-mfa/step-up-draft';
import { stepUpDraftScope } from '../content-schema-registry/content-schema-registry-step-up-scope';
import { stepUpTargetForLocation } from '../step-up-required';
import type { CmsWorkflowCommandOperationId } from './cms-workflow-command-specs';
import type {
  StepUpRecovery,
  WorkflowCommandInput,
  WorkflowCommandResult,
} from './cms-workflow-command-transport';
import {
  classifyWorkflowRefusal,
  type ClassifiedRefusal,
} from './cms-workflow-refusal';

/**
 * The state machine behind every Slice 11 command form. It owns what no field
 * may: the `Idempotency-Key` (kept across an unknown outcome and a step-up
 * detour, rotated after a definite refusal), the exactly-once guard, the
 * reconcile-before-retry rule, the tab-scoped step-up draft and the
 * explicit-reconfirmation state after return. It never replays by itself: a
 * step-up, a restore and an unknown outcome all wait for the person.
 */
export type CommandPhase =
  | 'idle'
  | 'pending'
  | 'committed'
  | 'refused'
  | 'unknown'
  | 'step-up-leaving'
  | 'step-up-unavailable'
  | 'signed-out'
  | 'restored'
  | 'conflict';

export interface SyncConflictState {
  readonly draftVersion: string | null;
  readonly currentVersion: string | null;
}

export interface CommandState<TResource> {
  readonly phase: CommandPhase;
  readonly idempotencyKey: string;
  readonly committed: TResource | null;
  readonly refusal: ClassifiedRefusal | null;
  readonly stepUpIssue: Extract<
    StepUpRecovery,
    { kind: 'no-method' | 'malformed' }
  > | null;
  readonly signInHref: string | null;
  readonly requestId: string | null;
  /** In `unknown`: the canonical read that follows the lost answer has succeeded. */
  readonly reconciled: boolean;
  readonly restoredValues: Readonly<Record<string, string>> | null;
  readonly conflict: SyncConflictState | null;
}

export interface WorkflowSubmission<TBody> {
  readonly body: TBody;
  /** The quoted strong `If-Match` operand the body is sent at. */
  readonly ifMatch: string;
  /** Only editable, non-identifying text: it is what a step-up detour stores. */
  readonly draft: Readonly<Record<string, string>>;
}

export interface WorkflowControllerOptions<TPath, TBody, TResource> {
  readonly operationId: CmsWorkflowCommandOperationId;
  /**
   * Names the tab-scoped step-up draft when one page holds two forms of the same
   * operation (an assignment create and a revoke); defaults to the operation.
   */
  readonly draftKey?: string;
  readonly ids: TPath;
  readonly send: (
    input: WorkflowCommandInput<TPath, TBody>,
  ) => Promise<WorkflowCommandResult<TResource>>;
  /** Re-reads the canonical workflow or review; true when the read succeeded. */
  readonly refetch: () => Promise<boolean>;
  readonly onCommitted: (resource: TResource) => void;
  readonly navigate: (target: string) => void;
  /** Lazy so a server render of the island never touches `window`. */
  readonly location: () => Readonly<{ pathname: string; search: string }>;
  readonly storage: () => DraftStorage | null;
  readonly newKey: () => string;
}

export interface WorkflowCommandController<TBody, TResource> {
  readonly getState: () => CommandState<TResource>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly submit: (submission: WorkflowSubmission<TBody>) => Promise<void>;
  /** Replays the byte-identical request of an unknown outcome, after reconciliation. */
  readonly retry: () => Promise<void>;
  readonly reconcile: () => Promise<void>;
  readonly dismiss: () => void;
  /** After a commit: forget it and begin a new command under a fresh key. */
  readonly startOver: () => void;
  /** Restores a step-up draft; opens a conflict when `currentVersion` moved. */
  readonly restore: (
    currentVersion: string | null,
  ) => Readonly<Record<string, string>> | null;
  readonly acknowledgeConflict: () => void;
}

const MISSING_TOKEN =
  'Your session is missing its security token. Reload the page.';
const INVALID_REQUEST =
  'This request could not be sent. Reload the page and try again.';

const localRefusal = (
  reason: 'csrf_missing' | 'request_invalid',
): ClassifiedRefusal => ({
  kind: 'invalid',
  message: reason === 'csrf_missing' ? MISSING_TOKEN : INVALID_REQUEST,
  rotateKey: false,
  refetch: false,
  fields: [],
  preflight: null,
  alternatives: null,
  foldAlternatives: null,
  window: null,
  requestId: null,
});

const operandOf = (ifMatch: string): string => ifMatch.slice(1, -1);

const signInHref = (
  location: Readonly<{ pathname: string; search: string }>,
): string =>
  `/auth/sign-in?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

export const createWorkflowCommandController = <TPath, TBody, TResource>(
  options: WorkflowControllerOptions<TPath, TBody, TResource>,
): WorkflowCommandController<TBody, TResource> => {
  const scope = (): string =>
    stepUpDraftScope(
      options.location().pathname,
      options.draftKey ?? options.operationId,
    );
  const listeners = new Set<() => void>();
  let lastRequest: WorkflowSubmission<TBody> | null = null;
  let state: CommandState<TResource> = {
    phase: 'idle',
    idempotencyKey: options.newKey(),
    committed: null,
    refusal: null,
    stepUpIssue: null,
    signInHref: null,
    requestId: null,
    reconciled: false,
    restoredValues: null,
    conflict: null,
  };

  const set = (next: Partial<CommandState<TResource>>): void => {
    state = { ...state, ...next };
    for (const listener of [...listeners]) listener();
  };
  const rotateKey = (): string => options.newKey();

  const reconcile = async (): Promise<void> => {
    if (state.phase !== 'unknown') return;
    const ok = await options.refetch();
    set({ reconciled: ok });
  };

  const settle = async (
    result: WorkflowCommandResult<TResource>,
    submission: WorkflowSubmission<TBody>,
  ): Promise<void> => {
    switch (result.kind) {
      case 'committed':
        lastRequest = null;
        clearStepUpDraft(options.storage(), scope());
        set({
          phase: 'committed',
          committed: result.resource,
          refusal: null,
          restoredValues: null,
        });
        options.onCommitted(result.resource);
        return;
      case 'step-up':
        if (result.recovery.kind !== 'navigate') {
          set({ phase: 'step-up-unavailable', stepUpIssue: result.recovery });
          return;
        }
        saveStepUpDraft(options.storage(), scope(), {
          values: submission.draft,
          idempotencyKey: state.idempotencyKey,
          expectedVersion: operandOf(submission.ifMatch),
        });
        set({ phase: 'step-up-leaving' });
        options.navigate(stepUpTargetForLocation(options.location()));
        return;
      case 'signed-out':
        set({
          phase: 'signed-out',
          requestId: result.requestId,
          signInHref: signInHref(options.location()),
        });
        return;
      case 'unknown':
        set({
          phase: 'unknown',
          reconciled: false,
          requestId: result.requestId,
        });
        await reconcile();
        return;
      case 'local':
        lastRequest = null;
        set({ phase: 'refused', refusal: localRefusal(result.reason) });
        return;
      case 'refused': {
        lastRequest = null;
        const refusal = classifyWorkflowRefusal(
          options.operationId,
          result.refusal,
        );
        set({
          phase: 'refused',
          refusal,
          idempotencyKey: refusal.rotateKey
            ? rotateKey()
            : state.idempotencyKey,
        });
        if (refusal.refetch) await options.refetch();
        return;
      }
    }
  };

  const dispatch = async (
    submission: WorkflowSubmission<TBody>,
  ): Promise<void> => {
    lastRequest = submission;
    set({ phase: 'pending', refusal: null, stepUpIssue: null, conflict: null });
    const result = await options.send({
      ids: options.ids,
      body: submission.body,
      ifMatch: submission.ifMatch,
      idempotencyKey: state.idempotencyKey,
    });
    await settle(result, submission);
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    submit: async (submission) => {
      // Exactly once: nothing is sent while a command is in flight, after it
      // committed, while its outcome is unknown (retry is its own, reconciled
      // action) or while a changed version waits for the person to review it.
      if (
        state.phase === 'pending' ||
        state.phase === 'committed' ||
        state.phase === 'unknown' ||
        state.phase === 'conflict' ||
        state.phase === 'step-up-leaving'
      )
        return;
      await dispatch(submission);
    },
    retry: async () => {
      if (
        state.phase !== 'unknown' ||
        !state.reconciled ||
        lastRequest === null
      )
        return;
      await dispatch(lastRequest);
    },
    reconcile,
    dismiss: () => {
      set({ phase: 'idle', refusal: null, stepUpIssue: null });
    },
    startOver: () => {
      if (state.phase !== 'committed') return;
      lastRequest = null;
      set({
        phase: 'idle',
        idempotencyKey: rotateKey(),
        committed: null,
        refusal: null,
        stepUpIssue: null,
        restoredValues: null,
        conflict: null,
      });
    },
    restore: (currentVersion) => {
      const draft = loadStepUpDraft(options.storage(), scope());
      if (draft === null) return null;
      const changed = draft.expectedVersion !== currentVersion;
      set({
        phase: changed ? 'conflict' : 'restored',
        idempotencyKey: draft.idempotencyKey,
        restoredValues: draft.values,
        conflict: changed
          ? { draftVersion: draft.expectedVersion, currentVersion }
          : null,
      });
      return draft.values;
    },
    acknowledgeConflict: () => {
      if (state.phase !== 'conflict') return;
      set({ phase: 'restored', conflict: null, idempotencyKey: rotateKey() });
    },
  };
};

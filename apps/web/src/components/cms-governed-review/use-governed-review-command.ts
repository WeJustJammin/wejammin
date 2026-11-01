import * as React from 'react';

import type { DraftStorage } from '../identity-authority/step-up-mfa/step-up-draft';
import {
  createWorkflowCommandController,
  type CommandState,
  type WorkflowCommandController,
} from '../cms-editorial-workflow/cms-workflow-command-controller';
import {
  newIdempotencyKey,
  type WorkflowCommandEnvironment,
} from '../cms-editorial-workflow/use-cms-workflow-command';
import type {
  GovernedCommandIds,
  GovernedCommandSpec,
} from './governed-review-command-specs';
import {
  classifyGovernedRefusalLazily,
  sendGovernedCommandLazily,
} from './governed-answer-machinery';
import type { ClassifiedRefusal } from '../cms-editorial-workflow/cms-workflow-refusal';

const sessionStorageOrNull = (): DraftStorage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export interface UseGovernedCommandInput<
  TBody extends object,
  TResource extends { readonly version: string },
> {
  readonly spec: GovernedCommandSpec<TBody, TResource>;
  readonly ids: GovernedCommandIds;
  /** Distinguishes two forms of one operation on a page (step-up draft scope). */
  readonly draftKey?: string;
  /** Re-reads the canonical review (and subject); true when the read verified. */
  readonly refetch: () => Promise<boolean>;
  readonly onCommitted: (resource: TResource) => void;
  readonly environment?: WorkflowCommandEnvironment;
}

/**
 * Binds the shared command state machine (key reuse across an unknown outcome and
 * a step-up detour, exactly-once, reconcile before retry, tab-scoped draft) to
 * React for a governed command. CMS-03C-07 and -08 are the 03b commands applied to
 * a definition review (DEC-137), so the shared fixed copy applies; the two
 * submission refusals the shared table cannot speak (`subject_not_submittable`,
 * `canonical_source_unavailable`) are classified here from the governed refusal the
 * transport kept. The draft key always names the governed operation, so a
 * governed draft never collides with the editorial decision on the same page.
 */
export const useGovernedCommand = <
  TBody extends object,
  TResource extends { readonly version: string },
>(
  input: UseGovernedCommandInput<TBody, TResource>,
): Readonly<{
  controller: WorkflowCommandController<TBody, TResource>;
  state: CommandState<TResource>;
}> => {
  const latest = React.useRef(input);
  React.useEffect(() => {
    latest.current = input;
  });
  // The classified governed refusal of the last answer, ready before the refused phase renders.
  const refusal = React.useRef<ClassifiedRefusal | null>(null);
  const [controller] = React.useState(() => {
    const environment = input.environment;
    return createWorkflowCommandController<
      GovernedCommandIds,
      TBody,
      TResource
    >({
      operationId: input.spec.classifyAs,
      draftKey: input.draftKey ?? input.spec.operationId,
      ids: input.ids,
      send: async (request) => {
        const result = await sendGovernedCommandLazily(
          input.spec,
          request,
          environment?.transport,
        );
        refusal.current =
          result.kind === 'refused'
            ? await classifyGovernedRefusalLazily(
                input.spec.operationId,
                result.refusal,
              )
            : null;
        return result;
      },
      refetch: () => latest.current.refetch(),
      onCommitted: (resource) => latest.current.onCommitted(resource),
      navigate:
        environment?.navigate ??
        ((target) => {
          window.location.assign(target);
        }),
      location: () => window.location,
      storage: environment?.storage ?? sessionStorageOrNull,
      newKey: environment?.newKey ?? newIdempotencyKey,
    });
  });
  const state = React.useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  const governed = state.phase === 'refused' ? refusal.current : null;
  // The shared controller refetches on the SHARED classification of a refusal. A governed classification that asks
  // for a refetch the shared table does not (`reviewer_not_eligible`, DEC-242) is honoured here, once per refused state.
  React.useEffect(() => {
    if (
      state.phase === 'refused' &&
      governed?.refetch === true &&
      state.refusal?.refetch !== true
    )
      void latest.current.refetch();
    // `governed` is derived from `state` and the ref set before the refused phase renders.
  }, [state]);
  return {
    controller,
    state: governed === null ? state : { ...state, refusal: governed },
  };
};

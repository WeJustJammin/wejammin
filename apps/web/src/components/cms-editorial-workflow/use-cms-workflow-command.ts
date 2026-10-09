import * as React from 'react';

import type { DraftStorage } from '../identity-authority/step-up-mfa/step-up-draft';
import type { CommandSpec } from './cms-workflow-command-specs';
import {
  createWorkflowCommandController,
  type CommandState,
  type WorkflowCommandController,
} from './cms-workflow-command-controller';
import {
  sendWorkflowCommand,
  type WorkflowTransportEnvironment,
} from './cms-workflow-command-transport';

/** A printable, unguessable `Idempotency-Key` (8-128 characters). */
export const newIdempotencyKey = (): string => {
  const api = globalThis.crypto;
  if (typeof api.randomUUID === 'function') return api.randomUUID();
  return [...api.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const sessionStorageOrNull = (): DraftStorage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/** Seams for a test; production uses the window, the tab storage and `fetch`. */
export interface WorkflowCommandEnvironment {
  readonly transport?: WorkflowTransportEnvironment;
  readonly navigate?: (target: string) => void;
  readonly newKey?: () => string;
  readonly storage?: () => DraftStorage | null;
}

export interface UseWorkflowCommandInput<TPath, TBody, TResource> {
  readonly spec: CommandSpec<TPath, TBody, TResource>;
  readonly ids: TPath;
  /** Distinguishes two forms of one operation on a page (step-up draft scope). */
  readonly draftKey?: string;
  /** Re-reads the canonical workflow or review; true when the read verified. */
  readonly refetch: () => Promise<boolean>;
  readonly onCommitted: (resource: TResource) => void;
  readonly environment?: WorkflowCommandEnvironment;
}

/**
 * Binds a command controller to React. The controller is created once per form
 * mount; the latest `refetch` and `onCommitted` are read at call time so a
 * re-render never restarts a command that is in flight.
 */
export const useWorkflowCommand = <TPath, TBody, TResource>(
  input: UseWorkflowCommandInput<TPath, TBody, TResource>,
): Readonly<{
  controller: WorkflowCommandController<TBody, TResource>;
  state: CommandState<TResource>;
}> => {
  const latest = React.useRef(input);
  React.useEffect(() => {
    latest.current = input;
  });
  const [controller] = React.useState(() => {
    const environment = input.environment;
    return createWorkflowCommandController<TPath, TBody, TResource>({
      operationId: input.spec.operationId,
      ...(input.draftKey === undefined ? {} : { draftKey: input.draftKey }),
      ids: input.ids,
      send: (request) =>
        sendWorkflowCommand(input.spec, request, environment?.transport),
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
  return { controller, state };
};

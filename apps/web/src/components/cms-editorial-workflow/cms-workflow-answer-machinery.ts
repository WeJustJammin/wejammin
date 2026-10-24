import { retryable } from '../../lib/retryable-import';
import { importModule } from '../../lib/module-unavailable';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import type { CmsWorkflowCommandOperationId } from './cms-workflow-command-specs';
import type {
  WorkflowCommandInput,
  WorkflowCommandResult,
  WorkflowRefusal,
  WorkflowTransportEnvironment,
} from './cms-workflow-command-transport';
import type { CommandSpec } from './cms-workflow-command-specs';
import type { ClassifiedRefusal } from './cms-workflow-refusal';

/**
 * The modules a command form needs only once a command is answered: the transport (request
 * building, answer parsing, step-up classification), the refusal classifier (the fixed refusal
 * copy) and, for the island, the canonical read. The Chrome route budget (P2-S11-AC-106) charges
 * every script a cold load fetches until idle, and a permitted publisher mounts several command
 * forms, so none of them is in a form's static import graph. The first send loads them; a form
 * that receives focus warms them, so by the time a person submits they are usually there (the
 * same intent signal as the validators, `warmCmsValidators`).
 *
 * A chunk that cannot be fetched is a failure the person can see and retry, never a command that
 * stays pending: the send answers a local "nothing was sent", the refusal falls back to a fixed
 * sentence, the read answers degraded. Nothing is cached, so the next action imports again.
 * `answerImporters` is the seam a test replaces.
 */
export const answerImporters = {
  transport: retryable(() => import('./cms-workflow-command-transport')),
  refusal: retryable(() => import('./cms-workflow-refusal')),
  canonicalRead: retryable(() => import('./cms-workflow-canonical-read')),
};

export const loadWorkflowTransport = () =>
  importModule(() => answerImporters.transport());

export const loadWorkflowRefusal = () =>
  importModule(() => answerImporters.refusal());

export const loadWorkflowCanonicalRead = () =>
  importModule(() => answerImporters.canonicalRead());

/** Sends a command; when the transport cannot load, nothing was sent. */
export const sendWorkflowCommandLazily = async <TPath, TBody, TResource>(
  spec: CommandSpec<TPath, TBody, TResource>,
  request: WorkflowCommandInput<TPath, TBody>,
  environment: WorkflowTransportEnvironment | undefined,
): Promise<WorkflowCommandResult<TResource>> => {
  let transport: Awaited<ReturnType<typeof loadWorkflowTransport>>;
  try {
    transport = await loadWorkflowTransport();
  } catch {
    return { kind: 'local', reason: 'module_unavailable' };
  }
  return transport.sendWorkflowCommand(spec, request, environment);
};

export const REFUSAL_UNAVAILABLE_COPY =
  'The request was refused, and part of this page that says why could not be loaded. Reload the page, then try again.';

/** What the person reads when the refusal classifier cannot load: fixed, never the response's. */
export const unavailableRefusal = (
  requestId: string | null,
): ClassifiedRefusal => ({
  kind: 'invalid',
  message: REFUSAL_UNAVAILABLE_COPY,
  rotateKey: true,
  refetch: true,
  fields: [],
  preflight: null,
  alternatives: null,
  foldAlternatives: null,
  window: null,
  requestId,
});

export const classifyRefusalLazily = async (
  operationId: CmsWorkflowCommandOperationId,
  refusal: WorkflowRefusal,
): Promise<ClassifiedRefusal> => {
  try {
    const { classifyWorkflowRefusal } = await loadWorkflowRefusal();
    return classifyWorkflowRefusal(operationId, refusal);
  } catch {
    return unavailableRefusal(refusal.requestId);
  }
};

export const DEGRADED_READ: CanonicalReadResult<never> = {
  kind: 'degraded',
  requestId: null,
};

/** The island's default read; when its module cannot load the read is degraded, not rejected. */
export const readWorkflowLazily = async (
  entryId: string,
  revisionId: string | null,
) => {
  try {
    const { readCanonicalWorkflow } = await loadWorkflowCanonicalRead();
    return readCanonicalWorkflow(entryId, revisionId);
  } catch {
    return DEGRADED_READ;
  }
};

const extraWarmers = new Set<() => void>();

/**
 * Another command family (the governed forms) adds what its own forms need after a send, so a
 * focused form of either family warms its machinery through the one frame.
 */
export const registerAnswerMachineryWarmer = (warm: () => void): void => {
  extraWarmers.add(warm);
};

/** A failure is swallowed here: the send that really needs the module reports its own. */
export const warmWorkflowAnswerMachinery = (): void => {
  loadWorkflowTransport().catch(() => undefined);
  loadWorkflowRefusal().catch(() => undefined);
  for (const warm of extraWarmers) warm();
};

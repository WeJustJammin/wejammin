import { retryable } from '../../lib/retryable-import';
import { importModule } from '../../lib/module-unavailable';
import {
  registerAnswerMachineryWarmer,
  DEGRADED_READ,
  unavailableRefusal,
} from '../cms-editorial-workflow/cms-workflow-answer-machinery';
import type { ClassifiedRefusal } from '../cms-editorial-workflow/cms-workflow-refusal';
import type {
  GovernedCommandInput,
  GovernedCommandResult,
  GovernedRefusal,
} from './governed-review-command-transport';
import type { GovernedCommandSpec } from './governed-review-command-specs';
import type { WorkflowTransportEnvironment } from '../cms-editorial-workflow/cms-workflow-command-transport';

/**
 * The modules a governed command form needs only once a command is answered: the transport, the
 * refusal classifiers (the fixed copy of the governed and activation refusals) and, for the
 * island, the canonical read. A reviewer offered every action mounts all the governed forms
 * after the first sign of intent, and Chrome charges the route for every script it fetches until
 * idle (P2-S11-AC-106, `bundle:check`), so none of them is in a form's static graph. The first
 * send loads them; a focused form warms them through the shared frame. A chunk that cannot be
 * fetched is reported as the failure it is and retried by the next action (see
 * `cms-workflow-answer-machinery.ts`). `governedAnswerImporters` is the seam a test replaces.
 */
export const governedAnswerImporters = {
  transport: retryable(() => import('./governed-review-command-transport')),
  refusal: retryable(() => import('./governed-review-refusal')),
  canonicalRead: retryable(() => import('./governed-review-canonical-read')),
};

export const loadGovernedTransport = () =>
  importModule(() => governedAnswerImporters.transport());

export const loadGovernedRefusal = () =>
  importModule(() => governedAnswerImporters.refusal());

export const loadGovernedCanonicalRead = () =>
  importModule(() => governedAnswerImporters.canonicalRead());

/** Sends a governed command; when the transport cannot load, nothing was sent. */
export const sendGovernedCommandLazily = async <
  TBody extends object,
  TResource extends { readonly version: string },
>(
  spec: GovernedCommandSpec<TBody, TResource>,
  request: GovernedCommandInput<TBody>,
  environment: WorkflowTransportEnvironment | undefined,
): Promise<GovernedCommandResult<TResource>> => {
  let transport: Awaited<ReturnType<typeof loadGovernedTransport>>;
  try {
    transport = await loadGovernedTransport();
  } catch {
    return { kind: 'local', reason: 'module_unavailable' };
  }
  return transport.sendGovernedCommand(spec, request, environment);
};

/** The governed classification of a refusal; a fixed sentence when its module cannot load. */
export const classifyGovernedRefusalLazily = async (
  operationId: GovernedCommandSpec<object, { version: string }>['operationId'],
  refusal: GovernedRefusal,
): Promise<ClassifiedRefusal | null> => {
  try {
    const { classifyGovernedRefusal } = await loadGovernedRefusal();
    return classifyGovernedRefusal(operationId, refusal);
  } catch {
    return unavailableRefusal(refusal.requestId);
  }
};

/** The governed island's default read; degraded, never rejected, when its module cannot load. */
export const readGovernedReviewLazily = async (reviewId: string) => {
  try {
    const { readCanonicalGovernedReview } = await loadGovernedCanonicalRead();
    return readCanonicalGovernedReview(reviewId);
  } catch {
    return DEGRADED_READ;
  }
};

/** A failure is swallowed here: the send that really needs the module reports its own. */
export const warmGovernedAnswerMachinery = (): void => {
  loadGovernedTransport().catch(() => undefined);
  loadGovernedRefusal().catch(() => undefined);
};

registerAnswerMachineryWarmer(warmGovernedAnswerMachinery);

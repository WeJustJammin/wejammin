import type { TemplateDesignerContext } from '@wejammin/contracts';

import type { CmsTemplateFormStatus } from './CmsTemplateStatus';
import { DIGEST_MISMATCH_REASON } from './cms-template-designer-submit';
import { useRegistryContext } from './use-registry-context';

const sameContext = (
  context: TemplateDesignerContext,
): TemplateDesignerContext => context;

/**
 * The template designers' block choices: re-read by themselves after a 409 `block_registry_digest_mismatch`
 * (FE03 1048; review V19 M2). Both the create and the successor designer take their context from here.
 */
export const useTemplateRegistry = (
  initial: TemplateDesignerContext,
  status: CmsTemplateFormStatus,
) =>
  useRegistryContext(
    initial,
    sameContext,
    status.kind === 'result' &&
      status.result.kind === 'conflict' &&
      status.result.reasonCode === DIGEST_MISMATCH_REASON,
  );

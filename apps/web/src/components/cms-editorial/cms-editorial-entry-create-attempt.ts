import type { AuthoringContextType, JsonValue } from '@wejammin/contracts';

import type { CmsEditorialCreateFormPrefill } from './cms-editorial-entry-create-form';
import type { CmsEditorialEntryCreateSubmitResult } from './cms-editorial-entry-create-submit';

/** Private capture: no mutable field or schema-prop reference survives a retry. */
export interface CmsEditorialEntryCreateAttempt {
  readonly prefill: CmsEditorialCreateFormPrefill;
  readonly values: Readonly<Record<string, JsonValue>>;
  readonly key: string | null;
}

/**
 * Capture before lazy loading or dispatch. Inputs are JSON-shaped authoring
 * evidence and validated values; the deep JSON copy isolates every nested
 * artifact, validator, policy and value from later prop/state replacements.
 * The private snapshot is never modified; only its returned attempt key changes.
 * Type-only imports keep zod and the transport out of the initial island.
 */
export const captureCmsEditorialEntryCreateAttempt = (
  type: AuthoringContextType,
  values: Readonly<Record<string, JsonValue>>,
  locale: string,
): CmsEditorialEntryCreateAttempt =>
  JSON.parse(
    JSON.stringify({
      prefill: {
        contentTypeId: type.contentTypeId,
        contentTypeVersionId: type.contentTypeVersionId,
        locale,
        schemaArtifact: type.schemaArtifact,
        validatorRefs: type.validatorRefs,
        workflowPolicy: type.workflowPolicy,
        activationEvidence: type.activationEvidence,
      },
      values,
      key: null,
    }),
  ) as CmsEditorialEntryCreateAttempt;

/** The lazy transport never loaded: no dispatch occurred and no UNKNOWN lock is needed. */
export const cmsEditorialEntryCreateUnavailable = (
  idempotencyKey: string,
): CmsEditorialEntryCreateSubmitResult => ({
  status: 'error',
  message:
    'The create could not be started. Nothing was created; check your connection and try again.',
  retryable: true,
  outcomeUnknown: false,
  unauthenticated: false,
  retryAfterSeconds: null,
  idempotencyKey,
});

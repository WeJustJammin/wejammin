import * as React from 'react';

import ContentSchemaRegistryCommandForm from './ContentSchemaRegistryCommandForm';
import { TextField } from './ContentSchemaRegistryCommandForm';
import ContentSchemaRegistryConfirmationStep from './ContentSchemaRegistryConfirmationStep';
import type {
  ContentSchemaRegistryCommandState,
  ContentSchemaRegistryUiError,
} from './content-schema-registry-types';

export interface ContentSchemaRegistryActivationFormProps {
  readonly action: string;
  readonly contentTypeId: string;
  readonly versionId: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly ifMatch: string;
  readonly expectedVersion: string;
  /** Sealed passed dry run of this exact version, prefilled by the server read. */
  readonly dryRunId: string;
  /** Approve-decision ids of the one approved review (FE03 G8); never typed. */
  readonly approvalIds: readonly string[];
  readonly state?: ContentSchemaRegistryCommandState;
  readonly error?: ContentSchemaRegistryUiError | undefined;
  /** Server-resolved human acting-context label; raw ids never reach here. */
  readonly actingContextLabel?: string;
  /** Browser-owned epoch bumped on a trusted acting-context change. */
  readonly contextEpoch?: number;
  /** Server-derived step-up disclosure state and absolute expiry. */
  readonly stepUpState?: 'required' | 'pending' | 'verified';
  readonly stepUpFreshUntil?: string;
}

/** CMS-03A-04: native no-JS activation form with an inline confirmation step. */
export default function ContentSchemaRegistryActivationForm({
  action,
  contentTypeId,
  versionId,
  csrfToken,
  idempotencyKey,
  ifMatch,
  expectedVersion,
  dryRunId,
  approvalIds,
  state = 'idle',
  error,
  actingContextLabel,
  contextEpoch = 0,
  stepUpState = 'required',
  stepUpFreshUntil,
}: ContentSchemaRegistryActivationFormProps): React.ReactElement {
  // Remount confirmation (resetting acknowledgement) whenever the displayed
  // acting context, the trusted context-change epoch, the target, the expected
  // version or the step-up window changes, while a same-projection refresh
  // preserves acknowledgement and draft fields. No identifier keys the reset.
  const confirmationKey = JSON.stringify([
    actingContextLabel ?? null,
    contextEpoch,
    contentTypeId,
    versionId,
    expectedVersion,
    stepUpState,
    stepUpFreshUntil ?? null,
  ]);
  return (
    <ContentSchemaRegistryCommandForm
      action={action}
      csrfToken={csrfToken}
      idempotencyKey={idempotencyKey}
      ifMatch={ifMatch}
      expectedVersion={expectedVersion}
      operationId="CMS-03A-04"
      formId="content-schema-registry-activation-form"
      state={state}
      {...(error === undefined ? {} : { error })}
      consequence="Activation affects the selected content type version and may change which schema future entries use."
    >
      <input type="hidden" name="contentTypeId" value={contentTypeId} />
      <input type="hidden" name="versionId" value={versionId} />
      <legend>Activate schema version</legend>
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <input type="hidden" name="dryRunId" value={dryRunId} />
      <input
        type="hidden"
        name="approvalIds"
        value={JSON.stringify(approvalIds)}
      />
      <p className="content-schema-registry-help">
        Activation uses the sealed dry run and the recorded approvals of the
        approved review for this version.
      </p>
      <ul
        className="content-schema-registry-approval-list"
        aria-label="Recorded approvals"
      >
        {approvalIds.map((approvalId) => (
          <li key={approvalId}>
            <code>{approvalId}</code>
          </li>
        ))}
      </ul>
      <TextField
        id="content-schema-registry-activation-evidence-hash"
        name="expectedActivationEvidenceHash"
        label="Expected activation evidence hash (optional)"
        required={false}
        maxLength={64}
      />
      <TextField
        id="content-schema-registry-activation-migration-plan-id"
        name="migrationPlanId"
        label="Migration plan ID (optional)"
        required={false}
        help="Leave blank to submit the required nullable migrationPlanId as null."
      />
      <TextField
        id="content-schema-registry-step-up-token"
        name="stepUpToken"
        label="Step-up token"
        type="password"
        autoComplete="one-time-code"
        help="A recent server-issued MFA/step-up token is required; it is never included in the JSON payload."
      />
      <ContentSchemaRegistryConfirmationStep
        key={confirmationKey}
        consequence="Activation affects the selected content type version and future entry validation."
        affectedScope={`Content type ${contentTypeId}, version ${versionId}`}
        expectedVersion={expectedVersion}
        stepUpState={stepUpState}
        idempotencyKey={idempotencyKey}
        {...(actingContextLabel === undefined ? {} : { actingContextLabel })}
        {...(stepUpFreshUntil === undefined ? {} : { stepUpFreshUntil })}
      />
    </ContentSchemaRegistryCommandForm>
  );
}

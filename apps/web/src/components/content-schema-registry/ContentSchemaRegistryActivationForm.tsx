import * as React from 'react';

import ContentSchemaRegistryCommandForm from './ContentSchemaRegistryCommandForm';
import { JsonField, TextField } from './ContentSchemaRegistryCommandForm';
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
  readonly state?: ContentSchemaRegistryCommandState;
  readonly error?: ContentSchemaRegistryUiError | undefined;
  /** Server-resolved human acting-context label; raw ids never reach here. */
  readonly actingContextLabel?: string;
  /** Locked acting-context identifier used only to key confirmation resets. */
  readonly actingPartyId?: string;
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
  state = 'idle',
  error,
  actingContextLabel,
  actingPartyId,
  stepUpState = 'required',
  stepUpFreshUntil,
}: ContentSchemaRegistryActivationFormProps): React.ReactElement {
  // Remount confirmation (resetting acknowledgement) whenever the acting
  // authority, target, expected version, or step-up window changes, while a
  // same-projection refresh preserves acknowledgement and draft fields.
  const confirmationKey = JSON.stringify([
    actingPartyId ?? null,
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
      <TextField
        id="content-schema-registry-expected-version"
        name="expectedVersion"
        label="Expected version"
        defaultValue={expectedVersion}
        help="The server compares this version with the If-Match precondition."
      />
      <TextField
        id="content-schema-registry-dry-run-id"
        name="dryRunId"
        label="Dry-run ID"
        help="Use the server-produced dry-run ID for this exact version."
      />
      <JsonField
        id="content-schema-registry-approval-ids"
        name="approvalIds"
        label="Approval IDs (JSON array)"
        defaultValue="[]"
        help="Provide one or more distinct server-issued approval UUIDs."
      />
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

import * as React from 'react';

import ContentSchemaRegistryCommandForm, {
  TextField,
} from './ContentSchemaRegistryCommandForm';
import {
  PathFields,
  type ContentSchemaRegistryVersionFormProps,
} from './ContentSchemaRegistryVersionFormParts';

/**
 * FE03 CMS-04a/b/c producers on the version page. Every form posts natively
 * to the version route; the route binds the path identifiers and the browser
 * supplies only the contract fields plus transport (CSRF, Idempotency-Key,
 * the exact source ETag). No version number, row id or identity is collected.
 */

export type { ContentSchemaRegistryVersionFormProps };
export { default as ContentSchemaRegistrySuccessorForm } from './ContentSchemaRegistrySuccessorForm';

/** CMS-03A-10: start the bounded dry run that produces the sealed report. */
export function ContentSchemaRegistryDryRunForm(
  props: ContentSchemaRegistryVersionFormProps,
): React.ReactElement {
  return (
    <ContentSchemaRegistryCommandForm
      action={props.action}
      csrfToken={props.csrfToken}
      idempotencyKey={props.idempotencyKey}
      ifMatch={props.ifMatch}
      expectedVersion={props.expectedVersion}
      operationId="CMS-03A-10"
      formId="content-schema-registry-dry-run-form"
      consequence="Queues a bounded dry run of this draft; the result appears only after the server seals the report."
    >
      <legend>Start schema dry run</legend>
      <PathFields {...props} />
      <TextField
        id="content-schema-registry-transform-key"
        name="transformKey"
        label="Transform key (optional)"
        required={false}
        maxLength={128}
        help="Enter both a transform key and its version, or leave both blank."
      />
      <TextField
        id="content-schema-registry-transform-version"
        name="transformVersion"
        label="Transform version (optional)"
        required={false}
        maxLength={19}
        help="Provide a version together with the key; neither is sent when both are blank."
      />
    </ContentSchemaRegistryCommandForm>
  );
}

/** CMS-03A-11: submit the sealed passed dry run for independent review. */
export function ContentSchemaRegistrySubmitReviewForm({
  dryRunId,
  ...props
}: ContentSchemaRegistryVersionFormProps & {
  readonly dryRunId: string;
}): React.ReactElement {
  return (
    <ContentSchemaRegistryCommandForm
      action={props.action}
      csrfToken={props.csrfToken}
      idempotencyKey={props.idempotencyKey}
      ifMatch={props.ifMatch}
      expectedVersion={props.expectedVersion}
      operationId="CMS-03A-11"
      formId="content-schema-registry-submit-review-form"
      consequence="Freezes this draft and its passed dry run for reviewers; editing is blocked until the review ends."
    >
      <legend>Submit for review</legend>
      <PathFields {...props} />
      <input type="hidden" name="dryRunId" value={dryRunId} />
      <p className="content-schema-registry-help">
        The sealed dry run for this exact version is submitted with the draft.
      </p>
    </ContentSchemaRegistryCommandForm>
  );
}

import * as React from 'react';

import ContentSchemaRegistryActivationForm from './ContentSchemaRegistryActivationForm';
import ContentSchemaRegistryFieldForm from './ContentSchemaRegistryFieldForm';
import ContentSchemaRegistryRelationForm from './ContentSchemaRegistryRelationForm';
import {
  ContentSchemaRegistryDryRunForm,
  ContentSchemaRegistrySubmitReviewForm,
  ContentSchemaRegistrySuccessorForm,
} from './ContentSchemaRegistryVersionForms';
import {
  activationInputs,
  hasNextAction,
  submitReviewDryRunId,
} from './content-schema-registry-version-actions';
import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';
import type {
  ContentSchemaRegistryDetail,
  ContentSchemaRegistryReviewState,
} from './content-schema-registry-types';

export interface ContentSchemaRegistryVersionCommandsProps {
  readonly detail: ContentSchemaRegistryDetail;
  readonly review: ContentSchemaRegistryReviewState | null;
  /** The version page route every native command form posts to. */
  readonly action: string;
  readonly csrfToken: string;
  readonly idempotencyKey: (operationId: string) => string;
  readonly expectedVersion: string;
  readonly actingContextLabel?: string | undefined;
  readonly stepUpState?: ContentSchemaRegistryStepUpState | undefined;
  readonly stepUpFreshUntil?: string | undefined;
  readonly contextEpoch: number;
}

/**
 * The designer's command stack for one version. Each DEC-108 producer renders
 * only when the server's `permittedNextActions` allow it and the prefilled
 * identifiers (sealed dry run, approved review's approve ids) exist.
 */
export default function ContentSchemaRegistryVersionCommands(
  props: ContentSchemaRegistryVersionCommandsProps,
): React.ReactElement {
  const { detail, review, action, csrfToken, idempotencyKey } = props;
  const preparation = detail.activationPreparation;
  const path = {
    action,
    contentTypeId: detail.resource.contentTypeId,
    versionId: detail.resource.id,
    csrfToken,
    expectedVersion: props.expectedVersion,
    ifMatch: `"${props.expectedVersion}"`,
  };
  const dryRunId = submitReviewDryRunId(preparation);
  const activation = activationInputs(preparation, review);
  return (
    <div className="content-schema-registry-command-stack">
      <ContentSchemaRegistryFieldForm
        action={action}
        contentTypeId={path.contentTypeId}
        versionId={path.versionId}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKey('CMS-03A-02')}
        ifMatch={path.ifMatch}
      />
      <ContentSchemaRegistryRelationForm
        action={action}
        contentTypeId={path.contentTypeId}
        versionId={path.versionId}
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKey('CMS-03A-03')}
        ifMatch={path.ifMatch}
      />
      {hasNextAction(preparation, 'create_successor') ? (
        <ContentSchemaRegistrySuccessorForm
          {...path}
          idempotencyKey={idempotencyKey('CMS-03A-09')}
        />
      ) : null}
      {hasNextAction(preparation, 'start_dry_run') ? (
        <ContentSchemaRegistryDryRunForm
          {...path}
          idempotencyKey={idempotencyKey('CMS-03A-10')}
        />
      ) : null}
      {dryRunId === null ? null : (
        <ContentSchemaRegistrySubmitReviewForm
          {...path}
          dryRunId={dryRunId}
          idempotencyKey={idempotencyKey('CMS-03A-11')}
        />
      )}
      {activation === null ? null : (
        <ContentSchemaRegistryActivationForm
          {...path}
          idempotencyKey={idempotencyKey('CMS-03A-04')}
          dryRunId={activation.dryRunId}
          approvalIds={activation.approvalIds}
          contextEpoch={props.contextEpoch}
          {...(props.actingContextLabel === undefined
            ? {}
            : { actingContextLabel: props.actingContextLabel })}
          {...(props.stepUpState === undefined
            ? {}
            : { stepUpState: props.stepUpState })}
          {...(props.stepUpFreshUntil === undefined
            ? {}
            : { stepUpFreshUntil: props.stepUpFreshUntil })}
        />
      )}
    </div>
  );
}

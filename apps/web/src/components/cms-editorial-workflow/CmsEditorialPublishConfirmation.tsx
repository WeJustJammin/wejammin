import {
  CMS_PREFLIGHT_CATEGORIES,
  CmsPublicationAudienceSchema,
  type FrozenCandidate,
} from '@wejammin/contracts';
import * as React from 'react';

import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from './CmsWorkflowCommandFrame';
import { WorkflowTextField } from './CmsWorkflowFields';
import { WORKFLOW_HEADING_IDS } from './CmsEditorialWorkflowPanel';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { isCommitBlocked } from './cms-workflow-form-state';
import {
  PREFLIGHT_CATEGORY_LABEL,
  PROJECTION_COPY,
} from './cms-workflow-labels';
import { useDraftFields } from './use-cms-workflow-draft-fields';
import {
  useWorkflowCommand,
  type WorkflowCommandEnvironment,
} from './use-cms-workflow-command';

export interface CmsEditorialPublishConfirmationProps {
  readonly entryId: string;
  readonly revisionId: string;
  /** The approved review's `version`: the `expectedVersion` and strong `If-Match`. */
  readonly reviewVersion: string;
  /** The approved review's frozen candidate, echoed unmodified. */
  readonly frozen: FrozenCandidate;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly onDone: (headingId: string) => void;
  readonly environment?: WorkflowCommandEnvironment;
}

/**
 * CMS-03B-09 as an inline confirmation step. It states what it will publish (the
 * frozen version set) and which checks run again, and says plainly that
 * publication replaces the active one for the audience and locale. The request
 * echoes the approved candidate; the server re-checks every part of it. A 202 is
 * "recorded": delivery convergence is reported later, never assumed here.
 */
export default function CmsEditorialPublishConfirmation({
  entryId,
  revisionId,
  reviewVersion,
  frozen,
  disabledReason,
  refetch,
  onDone,
  environment,
}: CmsEditorialPublishConfirmationProps): React.ReactElement {
  const [toggled, setToggled] = React.useState<boolean | null>(null);
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const { controller, state } = useWorkflowCommand({
    spec: WORKFLOW_COMMAND_SPECS['CMS-03B-09'],
    ids: {},
    refetch,
    onCommitted: () => {
      void refetch().then(() => onDone(WORKFLOW_HEADING_IDS.publications));
    },
    ...(environment === undefined ? {} : { environment }),
  });
  React.useEffect(() => {
    controller.restore(reviewVersion);
  }, [controller, reviewVersion]);
  const fields = useDraftFields(state.restoredValues);
  const audience = fields.value('audience');
  // A restored draft opens the confirmation; the person can still close it.
  const open = toggled ?? state.restoredValues !== null;

  const blocked = isCommitBlocked(state, disabledReason);
  const { versionSet } = frozen;
  const audienceError = localErrors[0]?.message ?? null;
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (blocked) return;
    const found: WorkflowLocalError[] = [];
    if (audience === '')
      found.push({
        id: 'publish-audience',
        label: 'Audience',
        message: 'Enter an audience.',
      });
    else if (!CmsPublicationAudienceSchema.safeParse(audience).success)
      found.push({
        id: 'publish-audience',
        label: 'Audience',
        message:
          'Use lowercase letters, digits, hyphens and underscores, up to 48 characters.',
      });
    setLocalErrors(found);
    if (found.length > 0) return;
    void controller.submit({
      body: {
        entryId,
        revisionId,
        frozenHash: frozen.frozenHash,
        expectedVersionSet: versionSet,
        audience,
        expectedVersion: reviewVersion,
      },
      ifMatch: `"${reviewVersion}"`,
      draft: { audience },
    });
  };
  return (
    <details
      open={open}
      onToggle={(event) => setToggled(event.currentTarget.open)}
    >
      <summary>Publish now</summary>
      <CmsWorkflowCommandFrame
        headingId="publish-form-title"
        title="Confirm publication"
        state={state}
        controller={controller}
        pendingLabel="Publishing…"
        committedLabel={(resource) =>
          `Publication recorded as version ${resource.version}. ${PROJECTION_COPY[resource.projectionState]}`
        }
        fieldIds={{ audience: { id: 'publish-audience', label: 'Audience' } }}
        localErrors={localErrors}
        disabledReason={disabledReason}
      >
        <p>
          Publishing replaces the active publication for this audience and
          locale.
        </p>
        <p>
          It publishes the approved candidate: content type version{' '}
          <code>{versionSet.schemaVersionId}</code>, settings version{' '}
          {versionSet.settingsVersion}, compiler {versionSet.compilerVersion}.
        </p>
        <p>These checks run again before anything is recorded:</p>
        <ul>
          {CMS_PREFLIGHT_CATEGORIES.map((category) => (
            <li key={category}>{PREFLIGHT_CATEGORY_LABEL[category]}</li>
          ))}
        </ul>
        <form onSubmit={submit}>
          <WorkflowTextField
            id="publish-audience"
            label="Audience"
            value={audience}
            autoComplete="off"
            hint="Lowercase letters, digits, hyphens and underscores, up to 48 characters."
            error={audienceError}
            invalid={(state.refusal?.fields ?? []).includes('audience')}
            onChange={(value) => fields.set('audience', value)}
          />
          <button
            type="submit"
            aria-disabled={blocked ? 'true' : 'false'}
            aria-busy={state.phase === 'pending' ? 'true' : 'false'}
          >
            Confirm publish
          </button>
        </form>
      </CmsWorkflowCommandFrame>
    </details>
  );
}

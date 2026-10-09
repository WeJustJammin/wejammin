import {
  CmsPreviewRouteSchema,
  CmsPublicationAudienceSchema,
  type VersionSet,
} from '@wejammin/contracts';
import * as React from 'react';

import CmsEditorialPreviewToken from './CmsEditorialPreviewToken';
import CmsWorkflowCommandFrame, {
  type WorkflowLocalError,
} from './CmsWorkflowCommandFrame';
import { WorkflowTextField } from './CmsWorkflowFields';
import { WORKFLOW_COMMAND_SPECS } from './cms-workflow-command-specs';
import { isCommitBlocked } from './cms-workflow-form-state';
import {
  useWorkflowCommand,
  type WorkflowCommandEnvironment,
} from './use-cms-workflow-command';

export interface CmsEditorialPreviewFormProps {
  readonly entryId: string;
  /** The entry `version`: the strong `If-Match` operand (E5). */
  readonly entryVersion: string;
  readonly revisionId: string;
  readonly locale: string;
  /** Echoed unmodified from the served preparation or the frozen candidate. */
  readonly versionSet: VersionSet;
  readonly disabledReason: string | null;
  readonly refetch: () => Promise<boolean>;
  readonly environment?: WorkflowCommandEnvironment;
  /** Seam for a test; production writes to the clipboard. */
  readonly copyText?: (text: string) => Promise<void>;
}

const AUDIENCE_ERROR =
  'Use lowercase letters, digits, hyphens and underscores, up to 48 characters.';
const ROUTE_ERROR =
  'Enter a site path that starts with one / and has no query, fragment or dot segments.';

const writeClipboard = (text: string): Promise<void> =>
  navigator.clipboard.writeText(text);

/**
 * CMS-03B-08. The request is the revision's locale, an audience, a normalized
 * site route and the version set echoed from the served candidate, at the entry
 * version. The 201 discloses the token once (see `CmsEditorialPreviewToken`); a
 * replay of an unknown outcome re-derives the same token under the same key.
 */
export default function CmsEditorialPreviewForm({
  entryId,
  entryVersion,
  revisionId,
  locale,
  versionSet,
  disabledReason,
  refetch,
  environment,
  copyText = writeClipboard,
}: CmsEditorialPreviewFormProps): React.ReactElement {
  const [audience, setAudience] = React.useState('');
  const [route, setRoute] = React.useState('');
  const [localErrors, setLocalErrors] = React.useState<
    readonly WorkflowLocalError[]
  >([]);
  const { controller, state } = useWorkflowCommand({
    spec: WORKFLOW_COMMAND_SPECS['CMS-03B-08'],
    ids: {},
    refetch,
    onCommitted: () => {
      void refetch();
    },
    ...(environment === undefined ? {} : { environment }),
  });
  React.useEffect(() => {
    if (state.phase === 'committed')
      document.getElementById('preview-token-title')?.focus();
  }, [state.phase]);

  const blocked = isCommitBlocked(state, disabledReason);
  const errorOf = (id: string): string | null =>
    localErrors.find((error) => error.id === id)?.message ?? null;
  const named = state.refusal?.fields ?? [];
  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (blocked) return;
    const found: WorkflowLocalError[] = [];
    if (audience === '')
      found.push({
        id: 'preview-audience',
        label: 'Audience',
        message: 'Enter an audience.',
      });
    else if (!CmsPublicationAudienceSchema.safeParse(audience).success)
      found.push({
        id: 'preview-audience',
        label: 'Audience',
        message: AUDIENCE_ERROR,
      });
    if (route === '')
      found.push({
        id: 'preview-route',
        label: 'Route',
        message: 'Enter a route.',
      });
    else if (!CmsPreviewRouteSchema.safeParse(route).success)
      found.push({ id: 'preview-route', label: 'Route', message: ROUTE_ERROR });
    setLocalErrors(found);
    if (found.length > 0) return;
    void controller.submit({
      body: { entryId, revisionId, locale, audience, route, versionSet },
      ifMatch: `"${entryVersion}"`,
      draft: { audience, route },
    });
  };
  const hide = (): void => {
    controller.startOver();
    setAudience('');
    setRoute('');
  };
  return (
    <CmsWorkflowCommandFrame
      headingId="preview-form-title"
      title="Create a preview"
      state={state}
      controller={controller}
      pendingLabel="Creating preview…"
      committedLabel={() => 'Preview created. The token is shown below once.'}
      fieldIds={{
        audience: { id: 'preview-audience', label: 'Audience' },
        route: { id: 'preview-route', label: 'Route' },
        locale: { id: 'preview-audience', label: 'Audience' },
      }}
      localErrors={localErrors}
      disabledReason={disabledReason}
      result={
        state.committed === null ? null : (
          <CmsEditorialPreviewToken
            preview={state.committed}
            copyText={copyText}
            onHide={hide}
          />
        )
      }
    >
      <p>Locale: {locale}</p>
      <form onSubmit={submit}>
        <WorkflowTextField
          id="preview-audience"
          label="Audience"
          value={audience}
          autoComplete="off"
          hint="Lowercase letters, digits, hyphens and underscores, up to 48 characters."
          error={errorOf('preview-audience')}
          invalid={named.includes('audience')}
          onChange={setAudience}
        />
        <WorkflowTextField
          id="preview-route"
          label="Route"
          value={route}
          autoComplete="off"
          hint="A site path that starts with /, for example /music/spring-2026-tour."
          error={errorOf('preview-route')}
          invalid={named.includes('route')}
          onChange={setRoute}
        />
        <button
          type="submit"
          aria-disabled={blocked ? 'true' : 'false'}
          aria-busy={state.phase === 'pending' ? 'true' : 'false'}
        >
          Create preview
        </button>
      </form>
    </CmsWorkflowCommandFrame>
  );
}

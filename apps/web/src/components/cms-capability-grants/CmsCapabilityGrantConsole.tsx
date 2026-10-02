import * as React from 'react';

import CmsCapabilityGrantCommandResult from './CmsCapabilityGrantCommandResult';
import CmsCapabilityGrantFilters from './CmsCapabilityGrantFilters';
import CmsCapabilityGrantForm from './CmsCapabilityGrantForm';
import CmsCapabilityGrantListRegion from './CmsCapabilityGrantListRegion';
import CmsCapabilityGrantContextEvidence from './CmsCapabilityGrantContextEvidence';
import CmsCapabilityGrantRowForm from './CmsCapabilityGrantRowForm';
import { COMMAND_COPY } from './cms-capability-grant-commands';
import { stepUpHref } from './cms-capability-grant-navigation';
import { cmsCapabilityGrantConsoleUrl } from './cms-capability-grant-url';
import { useStepUpFreshness } from '../content-schema-registry/use-step-up-freshness';
import type { GrantFieldErrors } from './cms-capability-grant-validation';
import type {
  CmsCapabilityGrantConsoleProps,
  CmsCapabilityGrantQueryState,
} from './cms-capability-grant-types';
import { useCmsCapabilityGrants } from './use-cms-capability-grants';

const FIELD_TARGETS = {
  person: 'cms-grant-person',
  capability: 'cms-grant-capability',
  validThrough: 'cms-grant-valid-through',
  reason: 'cms-grant-reason',
} as const;

const idempotencyKey = (operation: string, scope: string, epoch: number) =>
  `cms-grant-${operation}-${scope}-${epoch}`.slice(0, 128);

/**
 * `CmsCapabilityGrantConsole` (FE03 DEC-119/120): the owner-only island for
 * CMS-03A-15 grant, -16 renew, -17 revoke and the -18 list. The server owns
 * ownership, step-up, eligibility and the 90-day ceiling; this island only
 * bounds its inputs and renders the verified outcome. It is never optimistic.
 */
export default function CmsCapabilityGrantConsole(
  props: CmsCapabilityGrantConsoleProps,
): React.ReactElement {
  const state = useCmsCapabilityGrants(props);
  const freshness = useStepUpFreshness(props.contextEvidence.stepUpFreshUntil);
  const trigger = React.useRef<HTMLButtonElement | null>(null);
  if (props.access === 'not-rendered')
    return (
      <section
        data-workbench="cms-capability-grants"
        data-access="not-rendered"
      >
        <p role="status">{COMMAND_COPY.owner}</p>
      </section>
    );
  if (state.signedOut)
    return (
      <section data-workbench="cms-capability-grants" data-access="signed-out">
        <p role="status">{COMMAND_COPY.signIn}</p>
      </section>
    );
  const disabledAccess = props.access === 'disabled';
  const degraded = state.list.status === 'degraded';
  // FE03 role matrix: commit controls are enabled only while the step-up
  // disclosure is verified; otherwise they are disabled with the recovery.
  const stepUpVerified =
    props.contextEvidence.stepUpState === 'verified' && freshness.fresh;
  const commandsDisabled = disabledAccess || degraded || !stepUpVerified;
  const returnTo = cmsCapabilityGrantConsoleUrl(state.query);
  const failure =
    state.result?.state.status === 'failure' ? state.result : null;
  const serverErrors = (
    kind: 'grant' | 'renew' | 'revoke',
  ): GrantFieldErrors =>
    failure?.kind === kind && failure.state.status === 'failure'
      ? failure.state.fieldErrors
      : {};
  const requery = (next: CmsCapabilityGrantQueryState): void =>
    state.applyQuery(next, 'push');
  const close = (): void => {
    state.setOpenRow(null);
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <section
      className="content-schema-registry cms-capability-grants"
      data-workbench="cms-capability-grants"
      data-access={props.access}
      data-variant={props.variant}
      data-contract-source={props.contractFields.source}
      aria-labelledby="cms-grants-heading"
    >
      <header className="content-schema-registry-header">
        <p className="content-schema-registry-eyebrow">Owner only</p>
        <h2 id="cms-grants-heading">CMS access</h2>
        <p>
          Grant, renew or revoke CMS capabilities for people in your
          organization. Each grant ends on a date you choose, within 90 days.
        </p>
        <CmsCapabilityGrantContextEvidence evidence={props.contextEvidence} />
        {stepUpVerified || disabledAccess ? null : (
          <p data-step-up-recovery="true">
            {COMMAND_COPY.stepUp}{' '}
            <a href={stepUpHref(returnTo)}>Verify identity</a>
          </p>
        )}
      </header>
      <div role="status" aria-live="polite" aria-atomic="true">
        {state.result?.state.status === 'success'
          ? state.result.state.announcement
          : state.notice}
      </div>
      {state.result === null ||
      state.result.state.status === 'idle' ||
      state.result.state.status === 'pending' ? null : (
        <CmsCapabilityGrantCommandResult
          kind={state.result.kind}
          state={state.result.state}
          returnTo={returnTo}
          sequence={state.result.sequence}
          fieldTargets={FIELD_TARGETS}
          onShowExisting={state.showAttemptedCapability}
          onRetry={() => void state.refetch()}
        />
      )}
      <CmsCapabilityGrantFilters
        query={state.query}
        person={state.person}
        onQuery={requery}
        onPerson={state.applyPerson}
        onReset={state.resetFilters}
      />
      <div className="cms-capability-grant-layout">
        <div>
          <CmsCapabilityGrantListRegion
            state={state.list}
            query={state.query}
            retryUrl={props.retryUrl}
            requestId={props.requestId}
            loading={state.listLoading}
            commandsDisabled={commandsDisabled}
            personFilterActive={state.person.trim() !== ''}
            openGrantId={state.openRow?.grantId ?? null}
            onSort={state.sortBy}
            onRenew={(grant, button) => {
              trigger.current = button;
              state.setOpenRow({ grantId: grant.id, kind: 'renew' });
            }}
            onRevoke={(grant, button) => {
              trigger.current = button;
              state.setOpenRow({ grantId: grant.id, kind: 'revoke' });
            }}
            onGrantAgain={state.grantAgain}
            onNextPage={state.nextPage}
            onRetry={() => void state.refetch()}
            onGrantFocus={() =>
              document.getElementById(FIELD_TARGETS.person)?.focus()
            }
            onReset={state.resetFilters}
            rowForm={(grant) =>
              state.openRow === null ? null : (
                <CmsCapabilityGrantRowForm
                  kind={state.openRow.kind}
                  grant={grant}
                  csrfToken={props.csrfToken}
                  epoch={state.epoch}
                  termWindow={props.termWindow}
                  disabled={commandsDisabled}
                  pending={state.pending}
                  serverErrors={serverErrors(state.openRow.kind)}
                  onCancel={close}
                  onSubmit={(form) =>
                    void state.command(
                      state.openRow?.kind ?? 'renew',
                      form,
                      grant.id,
                    )
                  }
                />
              )
            }
          />
        </div>
        {disabledAccess ? null : (
          <CmsCapabilityGrantForm
            key={`${state.epoch}-${state.prefill?.nonce ?? 0}`}
            csrfToken={props.csrfToken}
            idempotencyKey={idempotencyKey('15', props.requestId, state.epoch)}
            termWindow={props.termWindow}
            disabled={commandsDisabled}
            pending={state.pending === 'grant'}
            serverErrors={serverErrors('grant')}
            initial={{
              subjectPersonId: state.prefill?.subjectPersonId ?? '',
              capability: state.prefill?.capability ?? '',
            }}
            onSubmit={(form) => void state.command('grant', form, null)}
          />
        )}
      </div>
    </section>
  );
}

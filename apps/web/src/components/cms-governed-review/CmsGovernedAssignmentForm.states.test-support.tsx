/** The harness of the CMS-03C-08 commandState suites: the real create and revoke forms over a replaced wire. */
import * as React from 'react';
import { vi } from 'vitest';
import {} from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import {} from '../../lib/cms-contract-validators';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  flush,
  mountWithIntent,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { localInputValue } from '../cms-editorial-workflow/cms-workflow-expiry';
import {
  REVIEWER_PERSON_ID,
  governedAssignmentFixture,
  governedAssignmentSummaryFixture,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedAssignmentForm from './CmsGovernedAssignmentForm';
import {} from './governed-command-states.test-support';
import { governedEnvironment } from './governed-review-form-test-support';

export const NOW = Date.parse('2026-10-08T12:00:00Z');
export const DAY = 24 * 3_600_000;
export const BOTH = ['assign_reviewer', 'revoke_assignment'];
export const review = (permittedNextActions: string[] = BOTH) =>
  governedDetailFixture({
    version: '2',
    permittedNextActions,
    assignments: [governedAssignmentSummaryFixture()],
  });
export const created = () =>
  jsonResponse(201, governedAssignmentFixture(), { etag: '"1"' });
export const revoked = () =>
  jsonResponse(200, governedAssignmentFixture({ state: 'revoked' }), {
    etag: '"1"',
  });

export const mount = (
  fetcher: ReturnType<typeof vi.fn>,
  extra: Partial<React.ComponentProps<typeof CmsGovernedAssignmentForm>> = {},
  storage = new MemoryStorage(),
) => {
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const navigate = vi.fn();
  const mounted = mountWithIntent(
    <CmsGovernedAssignmentForm
      review={review()}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      now={() => NOW}
      loadOptions={async () => ({
        kind: 'ok',
        options: [
          {
            personId: REVIEWER_PERSON_ID,
            endsAt: new Date(NOW + 30 * DAY).toISOString(),
          },
        ],
      })}
      environment={governedEnvironment(fetcher, storage, navigate)}
      {...extra}
    />,
  );
  return { ...mounted, refetch, onDone, navigate, storage };
};

export const ends = (container: HTMLElement) =>
  byLabel<HTMLInputElement>(container, 'Assignment ends');
export const why = (container: HTMLElement) =>
  byLabel<HTMLTextAreaElement>(container, 'Reason (optional)');
export const assign = (container: HTMLElement) =>
  buttonNamed(container, 'Assign reviewer');
export const revoke = (container: HTMLElement) =>
  buttonNamed(container, 'Revoke Reviewer A');
/** The revoke command is its own frame beside the create frame, each with its own status line. */
export const revokeFrame = (container: HTMLElement): HTMLElement =>
  container.querySelector(
    'section[aria-labelledby="governed-assignment-revoke-title"]',
  ) as HTMLElement;
export const fill = async (container: HTMLElement) => {
  await flush();
  await choose(
    byLabel<HTMLSelectElement>(container, 'Reviewer'),
    REVIEWER_PERSON_ID,
  );
  await typeInto(ends(container), localInputValue(NOW + DAY));
  await typeInto(why(container), 'Legal slot.');
};
export const create = async (container: HTMLElement) => {
  await fill(container);
  await click(assign(container));
};

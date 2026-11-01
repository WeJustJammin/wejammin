import { loadPinnedTimeAuthority } from '@wejammin/contracts/time-authority';
import type { Mock } from 'vitest';
import { vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  COMMAND_CASES,
  CSRF,
  REVOKE_CASE,
} from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialDecisionForm from './CmsEditorialDecisionForm';
import CmsEditorialPreviewForm from './CmsEditorialPreviewForm';
import CmsEditorialPublishConfirmation from './CmsEditorialPublishConfirmation';
import CmsEditorialReviewAssignmentForm from './CmsEditorialReviewAssignmentForm';
import CmsEditorialReviewSubmitForm from './CmsEditorialReviewSubmitForm';
import CmsEditorialScheduleForm from './CmsEditorialScheduleForm';
import { localInputValue } from './cms-workflow-expiry';
import {
  ASSIGNMENT_ID,
  ENTRY_ID,
  HASH_A,
  HASH_B,
  REVIEWER_PERSON_ID,
  REVISION_ID,
  jsonResponse,
  previewResourceFixture,
  publicationResourceFixture,
  reviewDetailFixture,
  scheduleResourceFixture,
  versionSetFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';
import { openDetails, type Fetcher } from './cms-workflow-focus.test-support';

/**
 * One row per Slice 11 command form: how to mount it over a fetcher, how a
 * person arms its commit control, what a committed answer looks like, and which
 * heading the form names for focus once the canonical read has landed.
 */
export interface FormWiring {
  readonly fetcher: Fetcher;
  readonly refetch: Mock<() => Promise<boolean>>;
  readonly onDone: Mock<(headingId: string) => void>;
}

export interface FormHarness {
  readonly name: string;
  readonly criterion: string;
  readonly mount: (wire: FormWiring) => { readonly container: HTMLElement };
  /** Fills the fields and returns the control a person activates to commit. */
  readonly arm: (container: HTMLElement) => Promise<HTMLButtonElement>;
  readonly success: () => Response;
  /** The heading `onDone` receives after the read, else null (the form owns it). */
  readonly resultHeading: string | null;
}

const NOW = Date.parse('2026-10-08T12:00:00Z');
const DAY = 24 * 3_600_000;
const authority = await loadPinnedTimeAuthority();

const environment = (fetcher: Fetcher) => ({
  transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
  newKey: () => 'idem-key-focus-000001',
  storage: () => null,
  navigate: () => undefined,
});

const created = (): Response => {
  const testCase = COMMAND_CASES['CMS-03B-18'];
  return jsonResponse(201, testCase.resource, {
    etag: testCase.etag as string,
    location: testCase.location as string,
  });
};

const assignment = {
  assignmentId: ASSIGNMENT_ID,
  version: '1',
  state: 'active',
  startsAt: '2026-10-08T12:00:00Z',
  endsAt: '2026-10-09T12:00:00Z',
  reviewerLabel: 'Reviewer 1',
};

export const FORM_HARNESSES: readonly FormHarness[] = [
  {
    name: 'Submit for review',
    criterion: 'P2-S11-AC-037',
    mount: ({ fetcher, refetch, onDone }) =>
      mountElement(
        <CmsEditorialReviewSubmitForm
          entryId={ENTRY_ID}
          entryVersion="7"
          revisionId={REVISION_ID}
          preparation={workflowFixture().preparation!}
          disabledReason={null}
          refetch={refetch}
          onDone={onDone}
          environment={environment(fetcher)}
        />,
      ),
    arm: async (container) => buttonNamed(container, /Submit for review \(/u),
    success: () => {
      const testCase = COMMAND_CASES['CMS-03B-05'];
      return jsonResponse(201, testCase.resource, {
        etag: testCase.etag as string,
        location: testCase.location as string,
      });
    },
    resultHeading: 'workflow-review-title',
  },
  {
    name: 'Record your decision',
    criterion: 'P2-S11-AC-037',
    mount: ({ fetcher, refetch, onDone }) =>
      mountElement(
        <CmsEditorialDecisionForm
          review={reviewDetailFixture({ version: '2' })}
          disabledReason={null}
          refetch={refetch}
          onDone={onDone}
          environment={environment(fetcher)}
        />,
      ),
    arm: async (container) => {
      await click(
        container.querySelector('input[value="approve"]') as HTMLElement,
      );
      await typeInto(
        byLabel<HTMLTextAreaElement>(container, 'Reason'),
        'Fine.',
      );
      return buttonNamed(container, /Record approval/u);
    },
    success: () => {
      const testCase = COMMAND_CASES['CMS-03B-06'];
      return jsonResponse(200, testCase.resource, {
        etag: testCase.etag as string,
      });
    },
    resultHeading: 'review-decisions-title',
  },
  {
    name: 'Schedule publication',
    criterion: 'P2-S11-AC-040',
    mount: ({ fetcher, refetch, onDone }) =>
      mountElement(
        <CmsEditorialScheduleForm
          revisionId={REVISION_ID}
          reviewVersion="5"
          disabledReason={null}
          refetch={refetch}
          onDone={onDone}
          now={() => NOW}
          defaultTimezone=""
          loadAuthority={async () => authority}
          publishPermitted
          environment={environment(fetcher)}
        />,
      ),
    arm: async (container) => {
      await openDetails(container);
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Local date and time'),
        '2026-11-02T09:30',
      );
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Time zone'),
        'America/New_York',
      );
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Audience'),
        'members',
      );
      return buttonNamed(container, 'Schedule');
    },
    success: () =>
      jsonResponse(
        202,
        scheduleResourceFixture({
          localDateTime: '2026-11-02T09:30',
          resolvedUtc: '2026-11-02T14:30:00Z',
        }),
        {
          etag: '"1"',
          location: COMMAND_CASES['CMS-03B-07'].location as string,
        },
      ),
    resultHeading: 'workflow-schedules-title',
  },
  {
    name: 'Create a preview',
    criterion: 'P2-S11-AC-043',
    mount: ({ fetcher, refetch }) =>
      mountElement(
        <CmsEditorialPreviewForm
          entryId={ENTRY_ID}
          entryVersion="7"
          revisionId={REVISION_ID}
          locale="en-US"
          versionSet={versionSetFixture as never}
          disabledReason={null}
          refetch={refetch}
          copyText={async () => undefined}
          environment={environment(fetcher)}
        />,
      ),
    arm: async (container) => {
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Audience'),
        'members',
      );
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Route'),
        '/music/artist/spring-2026-tour',
      );
      return buttonNamed(container, 'Create preview');
    },
    success: () => jsonResponse(201, previewResourceFixture(), {}),
    resultHeading: null,
  },
  {
    name: 'Confirm publication',
    criterion: 'P2-S11-AC-043',
    mount: ({ fetcher, refetch, onDone }) =>
      mountElement(
        <CmsEditorialPublishConfirmation
          entryId={ENTRY_ID}
          revisionId={REVISION_ID}
          reviewVersion="5"
          frozen={
            {
              frozenHash: HASH_A,
              dependencyHash: HASH_B,
              versionSet: versionSetFixture,
            } as never
          }
          disabledReason={null}
          refetch={refetch}
          onDone={onDone}
          environment={environment(fetcher)}
        />,
      ),
    arm: async (container) => {
      await openDetails(container);
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Audience'),
        'members',
      );
      return buttonNamed(container, 'Confirm publish');
    },
    success: () =>
      jsonResponse(202, publicationResourceFixture(), {
        etag: '"1"',
        location:
          '/api/v1/cms/publications/123e4567-e89b-42d3-a456-42661417400b',
      }),
    resultHeading: 'workflow-publications-title',
  },
  {
    name: 'Assign a reviewer',
    criterion: 'P2-S11-AC-072',
    mount: ({ fetcher, refetch, onDone }) =>
      mountElement(
        <CmsEditorialReviewAssignmentForm
          review={reviewDetailFixture({
            version: '2',
            permittedNextActions: ['assign_reviewer'],
          })}
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
          environment={environment(fetcher)}
        />,
      ),
    arm: async (container) => {
      await flush();
      await choose(
        byLabel<HTMLSelectElement>(container, 'Reviewer'),
        REVIEWER_PERSON_ID,
      );
      await typeInto(
        byLabel<HTMLInputElement>(container, 'Assignment ends'),
        localInputValue(NOW + DAY),
      );
      return buttonNamed(container, 'Assign reviewer');
    },
    success: created,
    resultHeading: 'review-assignments-title',
  },
  {
    name: 'Revoke an assignment',
    criterion: 'P2-S11-AC-072',
    mount: ({ fetcher, refetch, onDone }) =>
      mountElement(
        <CmsEditorialReviewAssignmentForm
          review={reviewDetailFixture({
            version: '2',
            permittedNextActions: ['revoke_assignment'],
            assignments: [assignment],
          })}
          disabledReason={null}
          refetch={refetch}
          onDone={onDone}
          now={() => NOW}
          loadOptions={async () => ({ kind: 'ok', options: [] })}
          environment={environment(fetcher)}
        />,
      ),
    arm: async (container) => buttonNamed(container, 'Revoke Reviewer 1'),
    success: () =>
      jsonResponse(200, REVOKE_CASE.resource, {
        etag: REVOKE_CASE.etag as string,
      }),
    resultHeading: 'review-assignments-title',
  },
];

export const newWiring = (fetcher: Fetcher): FormWiring => ({
  fetcher,
  refetch: vi.fn(async () => true),
  onDone: vi.fn(),
});

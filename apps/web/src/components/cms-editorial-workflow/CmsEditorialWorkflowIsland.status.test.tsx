// @vitest-environment jsdom
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { preloadWorkflowAnswerMachinery } from './cms-workflow-answer-machinery.test-support';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { COMMAND_CASES } from '../../server/cms-workflow-platform-command.test-support';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import {
  deferred,
  focusOn,
  openDetails,
  release,
  settle,
} from './cms-workflow-focus.test-support';
import {
  approvedWorkflowFixture,
  jsonResponse,
  previewResourceFixture,
  publicationResourceFixture,
  scheduleResourceFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';
import {
  formTitles,
  mountWorkflowIsland,
  ok,
} from './cms-workflow-island-mount.test-support';
import {
  formStatuses,
  islandStatus,
  readingOf,
  regionsReading,
} from './cms-workflow-status.test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.restoreAllMocks());

type Read = CanonicalReadResult<ReturnType<typeof workflowFixture>>;

const heldRead = () => {
  const pending = deferred<Read>();
  return { pending, readResource: () => pending.promise };
};

const SUBMITTED = 'Review submitted. It is open for decisions.';
const PREVIEWED = 'Preview created. The token is shown below once.';
const PUBLISHED =
  /^Publication recorded as version 1\. .*not confirmed visible/u;
const SCHEDULED = /^Scheduled, not published: /u;

/** The workflow after a submission: an open review, so the submit form is gone. */
const submitted = () =>
  approvedWorkflowFixture({
    review: {
      ...approvedWorkflowFixture().review!,
      state: 'open',
      decidedAt: null,
      recordedDecisionCount: 0,
    },
    permittedNextActions: ['preview'],
  });

/*
 * FE03 CMS-08/09/13 rows ("announce status", "focus stays until named result
 * heading", "server after success"): every Slice 11 workflow command confirms
 * itself in a polite atomic status line that the island owns, so the confirmation
 * outlives the canonical refetch that removes (or keeps) the form behind it.
 */
describe('CmsEditorialWorkflowIsland confirmation', () => {
  it('[P2-S11-AC-037] keeps one polite status line mounted outside every form before any command', () => {
    const { container } = mountWorkflowIsland(workflowFixture());
    const status = islandStatus(container);
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-atomic')).toBe('true');
    expect(status?.closest('[data-cms-workflow-form]')).toBeNull();
    expect(
      status?.closest('[aria-labelledby="workflow-actions-title"]'),
    ).not.toBeNull();
    expect(readingOf(status)).toBe('');
  });

  it('[P2-S11-AC-037] still reads the submit confirmation after the refetch removed the submit form, announced once', async () => {
    const { pending, readResource } = heldRead();
    const testCase = COMMAND_CASES['CMS-03B-05'];
    const { container } = mountWorkflowIsland(
      workflowFixture(),
      [],
      [
        jsonResponse(201, testCase.resource, {
          etag: testCase.etag as string,
          location: testCase.location as string,
        }),
      ],
      { readResource },
    );
    const line = islandStatus(container);
    const submit = focusOn(buttonNamed(container, /Submit for review \(/u));
    await click(submit);
    await settle();
    // In flight: the confirmation is in the island line, not twice.
    expect(regionsReading(container, SUBMITTED)).toEqual([line]);
    expect(formStatuses(container)).toEqual([]);
    expect(document.activeElement).toBe(submit);
    await release(pending, ok(submitted()));
    expect(document.activeElement?.id).toBe('workflow-review-title');
    expect(formTitles(container)).toEqual(['Create a preview']);
    expect(regionsReading(container, SUBMITTED)).toEqual([line]);
    expect(line?.isConnected).toBe(true);
    expect(line?.contains(document.activeElement)).toBe(false);
  });

  it('[P2-S11-AC-043] still reads the publication confirmation after the refetch removed the publish form', async () => {
    const { pending, readResource } = heldRead();
    const { container } = mountWorkflowIsland(
      approvedWorkflowFixture(),
      [],
      [
        jsonResponse(202, publicationResourceFixture(), {
          etag: '"1"',
          location:
            '/api/v1/cms/publications/123e4567-e89b-42d3-a456-42661417400b',
        }),
      ],
      { readResource },
    );
    const line = islandStatus(container);
    const publishDetails = [...container.querySelectorAll('details')].find(
      (details) => details.textContent?.includes('Confirm publication'),
    ) as HTMLDetailsElement;
    await openDetails(publishDetails);
    await typeInto(
      byLabel<HTMLInputElement>(publishDetails, 'Audience'),
      'members',
    );
    await click(buttonNamed(publishDetails, 'Confirm publish'));
    await settle();
    expect(regionsReading(container, PUBLISHED)).toEqual([line]);
    expect(publishDetails.textContent).not.toContain('Publication recorded');
    await release(
      pending,
      ok(approvedWorkflowFixture({ permittedNextActions: ['preview'] })),
    );
    expect(document.activeElement?.id).toBe('workflow-publications-title');
    expect(formTitles(container)).toEqual(['Create a preview']);
    expect(regionsReading(container, PUBLISHED)).toEqual([line]);
    expect(readingOf(line)).not.toMatch(/now live|is live|publicly visible/iu);
  });

  it('[P2-S11-AC-040] still reads "Scheduled, not published" after the refetch removed the schedule form', async () => {
    const { pending, readResource } = heldRead();
    // A date inside the 60 s to 366 d window of whatever day the suite runs.
    const local = new Date(Date.now() + 40 * 24 * 3_600_000)
      .toISOString()
      .slice(0, 16);
    const { container } = mountWorkflowIsland(
      approvedWorkflowFixture(),
      [],
      [
        jsonResponse(
          202,
          scheduleResourceFixture({
            localDateTime: local,
            timezone: 'UTC',
            resolvedUtc: `${local}:00Z`,
          }),
          {
            etag: '"1"',
            location: COMMAND_CASES['CMS-03B-07'].location as string,
          },
        ),
      ],
      { readResource },
    );
    const line = islandStatus(container);
    const scheduleDetails = container.querySelector(
      'details',
    ) as HTMLDetailsElement;
    await openDetails(scheduleDetails);
    for (const [label, value] of [
      ['Local date and time', local],
      ['Time zone', 'UTC'],
      ['Audience', 'members'],
    ] as const)
      await typeInto(byLabel<HTMLInputElement>(scheduleDetails, label), value);
    await vi.waitFor(() =>
      expect(
        scheduleDetails.querySelector('[data-cms-schedule-status]')
          ?.textContent,
      ).toContain(`${local}:00Z`),
    );
    await click(buttonNamed(scheduleDetails, 'Schedule'));
    await settle();
    expect(regionsReading(container, SCHEDULED)).toEqual([line]);
    expect(scheduleDetails.textContent).not.toContain(
      'Scheduled, not published',
    );
    await release(
      pending,
      ok(
        approvedWorkflowFixture({
          permittedNextActions: ['preview', 'publish'],
        }),
      ),
    );
    expect(document.activeElement?.id).toBe('workflow-schedules-title');
    expect(container.textContent).not.toContain('Schedule publication');
    expect(regionsReading(container, SCHEDULED)).toEqual([line]);
  });

  it('[P2-S11-AC-043] confirms the preview once in the island line and withdraws it when the token is hidden', async () => {
    const { container } = mountWorkflowIsland(
      workflowFixture(),
      [],
      [jsonResponse(201, previewResourceFixture(), {})],
    );
    const line = islandStatus(container);
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Route'),
      '/music/artist/spring-2026-tour',
    );
    await click(buttonNamed(container, 'Create preview'));
    await settle();
    // The token disclosure heading takes focus; the confirmation is announced
    // once, by the island line, while the form's own line stays empty.
    expect(document.activeElement?.id).toBe('preview-token-title');
    expect(regionsReading(container, PREVIEWED)).toEqual([line]);
    expect(formStatuses(container)).toEqual([]);
    // The token itself is never in a live status message.
    expect(readingOf(line)).not.toContain(previewResourceFixture().token);
    await click(buttonNamed(container, 'Hide token and create another'));
    expect(regionsReading(container, PREVIEWED)).toHaveLength(0);
    expect(readingOf(line)).toBe('');
  });

  it('[P2-S11-AC-037] is removed with the protected data when the session ends or the record is gone', async () => {
    const testCase = COMMAND_CASES['CMS-03B-05'];
    for (const kind of ['gone', 'signed-out'] as const) {
      const { container, unmount } = mountWorkflowIsland(
        workflowFixture(),
        [{ kind }],
        [
          jsonResponse(201, testCase.resource, {
            etag: testCase.etag as string,
            location: testCase.location as string,
          }),
        ],
      );
      await click(buttonNamed(container, /Submit for review \(/u));
      await vi.waitFor(() =>
        expect(
          container.querySelector('[data-cms-workflow-closed]'),
        ).not.toBeNull(),
      );
      expect(islandStatus(container)).toBeNull();
      expect(container.textContent).not.toContain(SUBMITTED);
      unmount();
    }
  });
});

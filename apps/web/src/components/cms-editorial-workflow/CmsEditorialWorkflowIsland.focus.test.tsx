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

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import {
  deferred,
  focusOn,
  lostFetcher,
  openDetails,
  release,
  settle,
} from './cms-workflow-focus.test-support';
import {
  apiError,
  approvedWorkflowFixture,
  jsonResponse,
  previewResourceFixture,
  publicationResourceFixture,
  scheduleResourceFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';
import {
  mountWorkflowIsland,
  ok,
} from './cms-workflow-island-mount.test-support';
import { COMMAND_CASES } from '../../server/cms-workflow-platform-command.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.restoreAllMocks());

type Workflow = ReturnType<typeof workflowFixture>;
type Read = CanonicalReadResult<Workflow>;

/** A read the test releases by hand, so the refetch is observed while it is in flight. */
const heldRead = () => {
  const pending = deferred<Read>();
  return { pending, readResource: () => pending.promise };
};

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

const submitAnswer = () => {
  const testCase = COMMAND_CASES['CMS-03B-05'];
  return jsonResponse(201, testCase.resource, {
    etag: testCase.etag as string,
    location: testCase.location as string,
  });
};

/*
 * FE03 / AC-037, AC-040, AC-043, AC-054: through the real island, focus stays
 * where the person put it until a named result heading, the refusal alert or
 * the local-error summary takes it, and a refetch never moves it.
 */
describe('CmsEditorialWorkflowIsland focus', () => {
  it('[P2-S11-AC-054] keeps focus where the person put it through a reconciling refetch, verified and then degraded', async () => {
    const first = deferred<Read>();
    const second = deferred<Read>();
    const queue = [first, second];
    const { container, readWorkflow } = mountWorkflowIsland(
      workflowFixture(),
      [],
      [],
      {
        fetcher: lostFetcher(),
        readResource: () => (queue.shift() as typeof first).promise,
      },
    );
    const submit = focusOn(buttonNamed(container, /Submit for review \(/u));
    const focusCalls = vi.spyOn(HTMLElement.prototype, 'focus');
    await click(submit);
    await settle();
    // The lost answer starts the reconciling read; it is in flight now.
    expect(readWorkflow).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(submit);
    await release(first, ok(workflowFixture()));
    expect(document.activeElement).toBe(submit);
    expect(container.querySelector('[data-cms-workflow-degraded]')).toBeNull();

    const check = focusOn(buttonNamed(container, 'Check the current state'));
    focusCalls.mockClear();
    await click(check);
    await settle();
    expect(readWorkflow).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(check);
    await release(second, { kind: 'degraded', requestId: null });
    expect(
      container.querySelector('[data-cms-workflow-degraded]'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(check);
    expect(focusCalls).not.toHaveBeenCalled();
  });

  it('[P2-S11-AC-037] keeps focus on the refusal alert while the refetch it triggered lands', async () => {
    const { pending, readResource } = heldRead();
    const { container, readWorkflow } = mountWorkflowIsland(
      workflowFixture(),
      [],
      [
        jsonResponse(
          409,
          apiError('CONFLICT', {
            reasonCode: 'dependency_changed',
            dependencyHash: 'd'.repeat(64),
          }),
        ),
      ],
      { readResource },
    );
    focusOn(buttonNamed(container, /Submit for review \(/u));
    await click(buttonNamed(container, /Submit for review \(/u));
    await settle();
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(readWorkflow).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(alert);
    await release(pending, ok(workflowFixture()));
    expect(container.querySelector('[role="alert"]')).toBe(alert);
    expect(document.activeElement).toBe(alert);
  });

  it('[P2-S11-AC-037] keeps focus on the activated control until the read lands, then moves it to the review heading only', async () => {
    const { pending, readResource } = heldRead();
    const { container } = mountWorkflowIsland(
      workflowFixture(),
      [],
      [submitAnswer()],
      { readResource },
    );
    const submit = focusOn(buttonNamed(container, /Submit for review \(/u));
    await click(submit);
    await settle();
    expect(container.textContent).toContain('Review submitted.');
    expect(document.activeElement).toBe(submit);
    await release(pending, ok(submitted()));
    expect(document.activeElement?.id).toBe('workflow-review-title');
  });

  it('[P2-S11-AC-043] leaves focus where the person moved it after the preview token took it, through the refetch', async () => {
    const { pending, readResource } = heldRead();
    const { container } = mountWorkflowIsland(
      workflowFixture(),
      [],
      [jsonResponse(201, previewResourceFixture(), {})],
      { readResource },
    );
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Route'),
      '/music/artist/spring-2026-tour',
    );
    focusOn(buttonNamed(container, 'Create preview'));
    await click(buttonNamed(container, 'Create preview'));
    await settle();
    // The named result region takes focus at the commit...
    expect(document.activeElement?.id).toBe('preview-token-title');
    const route = focusOn(byLabel<HTMLInputElement>(container, 'Route'));
    const focusCalls = vi.spyOn(HTMLElement.prototype, 'focus');
    // ...and the read that follows never takes it back from the person.
    await release(pending, ok(workflowFixture()));
    expect(document.activeElement).toBe(route);
    expect(focusCalls).not.toHaveBeenCalled();
  });

  it('[P2-S11-AC-043] keeps focus on Confirm publish until the read lands, then moves it to the publications heading only', async () => {
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
    const publishDetails = [...container.querySelectorAll('details')].find(
      (details) => details.textContent?.includes('Confirm publication'),
    ) as HTMLDetailsElement;
    await openDetails(publishDetails);
    await typeInto(
      byLabel<HTMLInputElement>(publishDetails, 'Audience'),
      'members',
    );
    const confirm = focusOn(buttonNamed(publishDetails, 'Confirm publish'));
    await click(confirm);
    await settle();
    expect(publishDetails.textContent).toContain('Publication recorded');
    expect(document.activeElement).toBe(confirm);
    await release(pending, ok(approvedWorkflowFixture()));
    expect(document.activeElement?.id).toBe('workflow-publications-title');
  });

  it('[P2-S11-AC-040] keeps focus on Schedule until the read lands, then moves it to the schedules heading only', async () => {
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
    const scheduleDetails = container.querySelector(
      'details',
    ) as HTMLDetailsElement;
    expect(scheduleDetails.textContent).toContain('Schedule publication');
    await openDetails(scheduleDetails);
    await typeInto(
      byLabel<HTMLInputElement>(scheduleDetails, 'Local date and time'),
      local,
    );
    await typeInto(
      byLabel<HTMLInputElement>(scheduleDetails, 'Time zone'),
      'UTC',
    );
    await typeInto(
      byLabel<HTMLInputElement>(scheduleDetails, 'Audience'),
      'members',
    );
    await vi.waitFor(() =>
      expect(
        scheduleDetails.querySelector('[data-cms-schedule-status]')
          ?.textContent,
      ).toContain(`${local}:00Z`),
    );
    const schedule = focusOn(buttonNamed(scheduleDetails, 'Schedule'));
    await click(schedule);
    await settle();
    expect(scheduleDetails.textContent).toContain('Scheduled, not published');
    expect(document.activeElement).toBe(schedule);
    await release(pending, ok(approvedWorkflowFixture()));
    expect(document.activeElement?.id).toBe('workflow-schedules-title');
  });
});

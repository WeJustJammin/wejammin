// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { COMMAND_CASES } from '../../server/cms-workflow-platform-command.test-support';
import {
  approvedReviewFixture,
  approvedWorkflowFixture,
  apiError,
  jsonResponse,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';
import {
  formTitles,
  mountWorkflowIsland,
  ok,
} from './cms-workflow-island-mount.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const mount = mountWorkflowIsland;

describe('CmsEditorialWorkflowIsland', () => {
  it('renders the panel and, for a submittable draft, the submit and preview forms only', () => {
    const { container } = mount(workflowFixture());
    expect(container.querySelector('[data-cms-workflow-panel]')).not.toBeNull();
    expect(formTitles(container)).toEqual([
      'Submit for review',
      'Create a preview',
    ]);
    expect(
      container.querySelector('#workflow-actions-title')?.textContent,
    ).toBe('Actions');
  });

  it('renders schedule, preview and publish for an approved revision from the frozen candidate', () => {
    const { container } = mount(approvedWorkflowFixture());
    expect(formTitles(container)).toEqual([
      'Schedule publication',
      'Create a preview',
      'Confirm publication',
    ]);
  });

  it('withholds a form whose action is not permitted and says why', () => {
    const publishOnly = approvedWorkflowFixture({
      permittedNextActions: ['preview'],
    });
    const { container } = mount(publishOnly);
    expect(formTitles(container)).toEqual(['Create a preview']);
    expect(container.textContent).toContain(
      'A second person with the publisher capability must publish this revision.',
    );
    expect(container.textContent).toContain(
      'Scheduling needs an approved revision and the publisher capability.',
    );
    const none = mount(workflowFixture({ permittedNextActions: [] }));
    expect(none.container.textContent).toContain(
      'This revision cannot be submitted for review by your account right now.',
    );
    expect(
      none.container.querySelectorAll('[data-cms-workflow-form]'),
    ).toHaveLength(0);
  });

  it('renders no preview form when neither a preparation nor a frozen candidate exists', () => {
    const { container } = mount(
      workflowFixture({
        preparation: null,
        review: null,
        permittedNextActions: ['preview'],
      }),
    );
    expect(formTitles(container)).toEqual([]);
  });

  it('refetches the canonical workflow after a commit and moves focus to the new review region', async () => {
    const submitted = approvedWorkflowFixture({
      review: {
        ...approvedWorkflowFixture().review!,
        state: 'open',
        decidedAt: null,
        recordedDecisionCount: 0,
      },
      permittedNextActions: ['preview'],
    });
    const testCase = COMMAND_CASES['CMS-03B-05'];
    const { container, readWorkflow } = mount(
      workflowFixture(),
      [ok(submitted)],
      [
        jsonResponse(201, testCase.resource, {
          etag: testCase.etag as string,
          location: testCase.location as string,
        }),
      ],
    );
    await click(buttonNamed(container, /Submit for review \(/u));
    await vi.waitFor(() =>
      expect(document.activeElement?.id).toBe('workflow-review-title'),
    );
    expect(readWorkflow).toHaveBeenCalledTimes(1);
    expect(formTitles(container)).toEqual(['Create a preview']);
    expect(container.textContent).toContain('Open the review');
  });

  it('keeps the last verified panel and withholds every command when a read cannot be verified', async () => {
    const testCase = COMMAND_CASES['CMS-03B-05'];
    const { container, fetcher } = mount(
      workflowFixture(),
      [{ kind: 'degraded', requestId: null }],
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
        container.querySelector('[data-cms-workflow-degraded]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-cms-workflow-degraded]')?.textContent,
    ).toContain('2026-10-08T12:00:00Z');
    expect(
      container.querySelector('[data-cms-workflow-disabled]')?.textContent,
    ).toBe(
      'The last read could not be verified. Commands are off until it is.',
    );
    const before = fetcher.mock.calls.length;
    await click(buttonNamed(container, /Create preview/u));
    expect(fetcher.mock.calls.length).toBe(before);
  });

  it('removes the protected data when the session ends or the record is gone', async () => {
    const testCase = COMMAND_CASES['CMS-03B-05'];
    const created = () =>
      jsonResponse(201, testCase.resource, {
        etag: testCase.etag as string,
        location: testCase.location as string,
      });
    const signedOut = mount(
      workflowFixture(),
      [{ kind: 'signed-out' }],
      [created()],
    );
    await click(buttonNamed(signedOut.container, /Submit for review \(/u));
    await vi.waitFor(() =>
      expect(
        signedOut.container.querySelector('[data-cms-workflow-closed]'),
      ).not.toBeNull(),
    );
    expect(
      signedOut.container.querySelector('[data-cms-workflow-panel]'),
    ).toBeNull();
    expect(signedOut.container.textContent).toContain('Your session expired.');
    expect(
      signedOut.container.querySelector('a[href^="/auth/sign-in?returnTo="]'),
    ).not.toBeNull();
    signedOut.unmount();
    const gone = mount(workflowFixture(), [{ kind: 'gone' }], [created()]);
    await click(buttonNamed(gone.container, /Submit for review \(/u));
    await vi.waitFor(() =>
      expect(
        gone.container.querySelector('[data-cms-workflow-closed]'),
      ).not.toBeNull(),
    );
    expect(gone.container.textContent).toContain(
      'This record is not available.',
    );
    expect(
      gone.container.querySelector('[data-cms-workflow-panel]'),
    ).toBeNull();
  });

  it('is a failed read, not a commit, that leaves the surface usable after a refusal refetch', async () => {
    const { container, readWorkflow } = mount(
      workflowFixture(),
      [ok(workflowFixture())],
      [
        jsonResponse(
          409,
          apiError('CONFLICT', {
            reasonCode: 'dependency_changed',
            dependencyHash: 'd'.repeat(64),
          }),
        ),
      ],
    );
    await click(buttonNamed(container, /Submit for review \(/u));
    await vi.waitFor(() => expect(readWorkflow).toHaveBeenCalledTimes(1));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'The checks changed. Review the updated results.',
    );
    expect(formTitles(container)).toContain('Submit for review');
  });

  it('uses the approved review frozen candidate for the schedule and publish forms', () => {
    const { container } = mount(
      approvedWorkflowFixture({
        review: {
          ...approvedWorkflowFixture().review!,
          ...approvedReviewFixture({ version: '9' }),
        },
      }),
    );
    expect(container.querySelector('#schedule-form-title')).not.toBeNull();
    expect(container.querySelector('#publish-form-title')).not.toBeNull();
  });
});

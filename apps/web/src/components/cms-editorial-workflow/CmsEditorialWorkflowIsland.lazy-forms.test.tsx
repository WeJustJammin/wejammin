// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  approvedWorkflowFixture,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';
import {
  mountReviewIsland,
  mountWorkflowIsland,
} from './cms-workflow-island-mount.test-support';

/*
 * FE03 "Performance budgets and loading strategy": in the browser a command form is a lazy chunk
 * (`cms-workflow-form-views.ts`, `cms-review-form-views.ts`). Each form sits in a boundary of its
 * own, so a chunk that has not arrived never hides the panel or a sibling form that has. The
 * views modules are replaced here by forms that stay suspended until a test releases them.
 */
const gates = vi.hoisted(() => ({
  release: {} as Record<string, () => void>,
}));

vi.mock('./cms-workflow-form-views', () => ({
  ...suspendedViews([
    'ReviewSubmitFormView',
    'ScheduleFormView',
    'PreviewFormView',
    'PublishConfirmationView',
  ]),
}));
vi.mock('./cms-review-form-views', () => ({
  ...suspendedViews(['DecisionFormView', 'ReviewAssignmentFormView']),
}));

function suspendedViews(names: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(
    names.map((name) => [
      name,
      React.lazy(
        () =>
          new Promise<{ default: React.ComponentType }>((resolve) => {
            gates.release[name] = () =>
              resolve({
                default: () => <form data-lazy-form={name}>{name}</form>,
              });
          }),
      ),
    ]),
  );
}

beforeAll(enableReactAct);
afterAll(disableReactAct);

const present = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-lazy-form]')].map(
    (form) => form.getAttribute('data-lazy-form') ?? '',
  );

describe('CmsEditorialWorkflowIsland with its forms still loading', () => {
  it('renders the panel and the actions heading while no form has arrived, then each form as its own chunk lands', async () => {
    const { container } = mountWorkflowIsland(approvedWorkflowFixture());
    await flush();
    expect(container.querySelector('[data-cms-workflow-panel]')).not.toBeNull();
    expect(
      container.querySelector('#workflow-actions-title')?.textContent,
    ).toBe('Actions');
    expect(present(container)).toEqual([]);

    gates.release.PreviewFormView?.();
    await flush();
    expect(present(container)).toEqual(['PreviewFormView']);
    expect(container.querySelector('[data-cms-workflow-panel]')).not.toBeNull();

    gates.release.ScheduleFormView?.();
    gates.release.PublishConfirmationView?.();
    await flush();
    expect(present(container)).toEqual([
      'ScheduleFormView',
      'PreviewFormView',
      'PublishConfirmationView',
    ]);
  });
});

describe('CmsEditorialReviewDetailIsland with its forms still loading', () => {
  it('renders the review while the forms load, each form in a boundary of its own', async () => {
    const { container } = mountReviewIsland(
      reviewDetailFixture({
        permittedNextActions: [
          'record_decision',
          'assign_reviewer',
          'revoke_assignment',
        ],
      }),
    );
    await flush();
    expect(container.querySelector('[data-cms-review-detail]')).not.toBeNull();
    expect(present(container)).toEqual([]);

    gates.release.ReviewAssignmentFormView?.();
    await flush();
    expect(present(container)).toEqual(['ReviewAssignmentFormView']);

    gates.release.DecisionFormView?.();
    await flush();
    expect(present(container)).toEqual([
      'DecisionFormView',
      'ReviewAssignmentFormView',
    ]);
  });
});

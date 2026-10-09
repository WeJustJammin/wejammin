// @vitest-environment jsdom
import { createRequire } from 'node:module';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { CSRF } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialReviewDetailIsland from './CmsEditorialReviewDetailIsland';
import CmsEditorialReviewQueue from './CmsEditorialReviewQueue';
import CmsEditorialWorkflowIsland from './CmsEditorialWorkflowIsland';
import {
  ASSIGNMENT_ID,
  ENTRY_ID,
  INSTANT,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  apiError,
  approvedWorkflowFixture,
  jsonResponse,
  preflightReportFixture,
  queueItem,
  queuePageFixture,
  reviewDetailFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';

/*
 * FE03 testing floor: axe with no serious or critical finding on every Slice 11
 * surface, in the states a person meets: clean, refused, restored, in conflict,
 * degraded and disclosed. The surfaces are mounted for real (islands through
 * their own controllers) inside the landmarks the shared shell provides, and
 * axe runs over the live DOM. jsdom has no layout, so colour contrast and target
 * size are covered by the e2e and manual accessibility reports, not here; every
 * structural rule (names, labels, roles, ARIA validity, headings, landmarks,
 * duplicate ids) runs.
 */
const requireFromPlaywright = createRequire(
  createRequire(import.meta.url).resolve('@axe-core/playwright'),
);
const axe = requireFromPlaywright('axe-core') as {
  run: (
    context: Element | Document,
    options: Record<string, unknown>,
  ) => Promise<{
    violations: Array<{
      id: string;
      impact: string | null;
      help: string;
      nodes: Array<{ target: unknown[] }>;
    }>;
  }>;
};

// axe runs and the 218 KB tz snapshot are slow on a loaded host; waits are
// conditions, not budgets (the specs assert the real budgets elsewhere).
vi.setConfig({ testTimeout: 90_000 });

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  document.body.replaceChildren();
});

const mountInShell = (element: React.ReactElement) => {
  document.documentElement.lang = 'en';
  document.title = 'Review and publish | WeJammin';
  document.cookie = `wj_csrf=${CSRF}`;
  document.body.innerHTML =
    '<nav aria-label="Skip navigation"><a href="#cms-editorial-main">Skip to main content</a></nav>' +
    '<main id="cms-editorial-main" tabindex="-1"><h1 id="page-title" tabindex="-1">Review and publish</h1></main>';
  const main = document.getElementById('cms-editorial-main') as HTMLElement;
  const mounted = mountElement(element);
  main.appendChild(mounted.container);
  return mounted;
};

const findings = async (): Promise<string[]> => {
  const result = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
    rules: {
      'color-contrast': { enabled: false },
      'target-size': { enabled: false },
    },
  });
  return result.violations.map(
    (violation) =>
      `${violation.impact ?? 'n/a'} ${violation.id}: ${violation.help} (${violation.nodes
        .map((node) => String(node.target[0]))
        .slice(0, 3)
        .join(' | ')})`,
  );
};

const environment = (responses: readonly Response[] = []) => {
  const queue = [...responses];
  return {
    transport: {
      fetcher: vi.fn(async () => queue.shift() as Response),
      documentRef: { cookie: `wj_csrf=${CSRF}` },
    },
    newKey: () => 'idem-key-axe-000001',
    storage: () => null,
    navigate: () => undefined,
  };
};

const island = (
  workflow: ReturnType<typeof workflowFixture>,
  responses: readonly Response[] = [],
) =>
  mountInShell(
    <CmsEditorialWorkflowIsland
      init={{
        workflow,
        entryId: ENTRY_ID,
        revisionId: null,
        verifiedAt: INSTANT,
      }}
      readWorkflow={async () => ({ kind: 'ok', resource: workflow })}
      environment={environment(responses)}
    />,
  );

const detail = (
  review: ReturnType<typeof reviewDetailFixture>,
  responses: readonly Response[] = [],
) =>
  mountInShell(
    <CmsEditorialReviewDetailIsland
      init={{ review, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
      readReview={async () => ({ kind: 'ok', resource: review })}
      loadOptions={async () => ({
        kind: 'ok',
        options: [{ personId: REVIEWER_PERSON_ID, endsAt: LATER }],
      })}
      environment={environment(responses)}
    />,
  );

describe('Slice 11 workflow surfaces: axe', () => {
  it('a submittable draft: panel, 17 checks, submit and preview forms', async () => {
    island(workflowFixture());
    expect(await findings()).toEqual([]);
  });

  it('checks with a failed, an unavailable and an unbuilt-provider result', async () => {
    island(
      workflowFixture({
        preparation: {
          ...workflowFixture().preparation!,
          preflight: preflightReportFixture({
            contract: { outcome: 'failed', reasonCode: 'value_invalid' },
            accessibility: {
              outcome: 'unavailable',
              reasonCode: 'checker_failed',
            },
            media: {
              outcome: 'failed',
              reasonCode: 'provider_unbuilt_reference',
            },
          }),
        },
      }),
    );
    expect(await findings()).toEqual([]);
  });

  it('an approved revision with schedules, publications and every form closed', async () => {
    island(
      approvedWorkflowFixture({
        schedules: [
          {
            id: ASSIGNMENT_ID,
            version: '2',
            state: 'blocked',
            action: 'publish',
            audience: 'members',
            resolvedUtc: '2026-11-01T14:30:00Z',
            reasonCode: 'preflight_failed',
          },
        ],
        publications: [
          {
            publicationId: ASSIGNMENT_ID,
            publicationVersionId: REVIEW_ID,
            version: '3',
            state: 'active',
            action: 'publish',
            revisionId: ENTRY_ID,
            locale: 'en-US',
            audience: 'members',
            publicationHash: 'a'.repeat(64),
            projectionState: 'pending',
            createdAt: INSTANT,
          },
        ],
      }),
    );
    expect(await findings()).toEqual([]);
  });

  it('a refused submit: the alert with the failed-checks list', async () => {
    const { container } = island(workflowFixture(), [
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', {
          reasonCode: 'preflight_failed',
          preflight: [
            {
              category: 'contract',
              outcome: 'failed',
              reasonCode: 'value_invalid',
            },
          ],
        }),
      ),
    ]);
    await click(buttonNamed(container, /Submit for review \(/u));
    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')).not.toBeNull(),
    );
    expect(await findings()).toEqual([]);
  });

  it('the schedule form opened: local errors, an ambiguous time and its earlier/later choice', async () => {
    const { container } = island(approvedWorkflowFixture());
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    await React.act(async () => {
      details.dispatchEvent(new Event('toggle'));
    });
    await vi.waitFor(
      () =>
        expect(
          container.querySelectorAll('datalist option').length,
        ).toBeGreaterThan(100),
      { timeout: 20_000 },
    );
    await click(buttonNamed(container, 'Schedule'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Local date and time'),
      '2026-11-01T01:30',
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Time zone'),
      'America/New_York',
    );
    expect(
      container.querySelector('[data-cms-schedule-resolution] fieldset'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Local date and time'),
      '2027-03-14T02:30',
    );
    expect(
      container.querySelector('[data-cms-schedule-resolution] fieldset'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
  });

  it('the publish confirmation opened, and a preview token disclosed', async () => {
    const { container } = island(approvedWorkflowFixture());
    for (const details of container.querySelectorAll('details')) {
      (details as HTMLDetailsElement).open = true;
    }
    expect(await findings()).toEqual([]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Route'),
      '/music/spring-2026',
    );
    expect(await findings()).toEqual([]);
  });
});

describe('Slice 11 review surfaces: axe', () => {
  it('the review detail for an assignee: evidence, decisions and the decision form', async () => {
    detail(
      reviewDetailFixture({
        myAssignment: { assignmentId: ASSIGNMENT_ID, endsAt: LATER },
        decisions: [
          {
            id: '123e4567-e89b-42d3-a456-426614176001',
            decision: 'approve',
            capability: 'cms.reviewer',
            decidedAt: LATER,
            mine: false,
            reason: null,
          },
        ],
        recordedDecisionCount: 1,
        requiredDecisionCount: 1,
        distinctApprovalCount: 1,
      }),
    );
    expect(await findings()).toEqual([]);
  });

  it('a refused decision: local errors, then the capability gate', async () => {
    const { container } = detail(reviewDetailFixture(), [
      jsonResponse(
        403,
        apiError('FORBIDDEN', { reasonCode: 'separation_of_duties' }),
      ),
    ]);
    await click(buttonNamed(container, /Record/u));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
    await click(
      container.querySelector('input[value="approve"]') as HTMLElement,
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
    await click(buttonNamed(container, /Record approval/u));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-cms-editorial-capability-gate]'),
      ).not.toBeNull(),
    );
    expect(await findings()).toEqual([]);
  });

  it('the owner view: assignment list, assign and revoke controls', async () => {
    const { container } = detail(
      reviewDetailFixture({
        permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
        assignments: [
          {
            assignmentId: ASSIGNMENT_ID,
            version: '1',
            state: 'active',
            startsAt: INSTANT,
            endsAt: LATER,
            reviewerLabel: 'Reviewer 1',
          },
        ],
      }),
    );
    await flush();
    expect(container.querySelector('#assignment-create-title')).not.toBeNull();
    expect(await findings()).toEqual([]);
    await choose(
      byLabel<HTMLSelectElement>(container, 'Reviewer'),
      REVIEWER_PERSON_ID,
    );
    await click(buttonNamed(container, 'Assign reviewer'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
  });
});

describe('Slice 11 reviewer queue: axe', () => {
  const queue = (
    page: ReturnType<typeof queuePageFixture>,
    query: Record<string, string> = {},
  ) => {
    document.documentElement.lang = 'en';
    document.title = 'Reviews | WeJammin';
    document.body.innerHTML =
      '<nav aria-label="Skip navigation"><a href="#cms-editorial-main">Skip to main content</a></nav>' +
      '<main id="cms-editorial-main" tabindex="-1"><h1 id="page-title" tabindex="-1">Reviews</h1>' +
      renderToStaticMarkup(
        <CmsEditorialReviewQueue
          page={page}
          routePath="/app/cms-content-modeling/reviews"
          query={query}
        />,
      ) +
      '</main>';
  };

  it('a populated page with a continuation', async () => {
    queue(
      queuePageFixture(
        [
          queueItem(1),
          queueItem(2, {
            riskClass: 'protected',
            requiredDecisionCount: 2,
            myDecision: 'approve',
          }),
        ],
        'cursor.1',
      ),
    );
    expect(await findings()).toEqual([]);
  });

  it('no records and filter-miss', async () => {
    queue(queuePageFixture([]));
    expect(await findings()).toEqual([]);
    queue(queuePageFixture([]), { scope: 'submitted', state: 'rejected' });
    expect(await findings()).toEqual([]);
  });
});

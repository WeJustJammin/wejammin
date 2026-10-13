// @vitest-environment jsdom
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
import {
  COMMAND_CASES,
  CSRF,
} from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialReviewDetailIsland from './CmsEditorialReviewDetailIsland';
import CmsEditorialReviewQueue from './CmsEditorialReviewQueue';
import CmsEditorialWorkflowIsland from './CmsEditorialWorkflowIsland';
import { localInputValue } from './cms-workflow-expiry';
import {
  ASSIGNMENT_ID,
  ENTRY_ID,
  HASH_A,
  HASH_B,
  INSTANT,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  REVISION_ID,
  TOKEN,
  apiError,
  approvedWorkflowFixture,
  jsonResponse,
  queueItem,
  queuePageFixture,
  reviewDetailFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';

// axe runs and the 218 KB tz snapshot are slow on a loaded host; waits are
// conditions, not budgets (the specs assert the real budgets elsewhere).
vi.setConfig({ testTimeout: 90_000 });

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

/*
 * FE03: the frozen manifest and version set, the preflight report, decision
 * reasons, the preview token and every assignment identifier are re-derived by
 * the server and never enter a URL, analytics, a log or any browser store. These
 * checks drive the real flows (a step-up detour of each protected command and
 * a preview mint) and then read every place a value could leak.
 */
const SENSITIVE = [
  HASH_A,
  HASH_B,
  TOKEN,
  REVIEWER_PERSON_ID,
  'dependencyManifest',
  'schemaArtifact',
  'rich_text.v1',
  'expectedVersionSet',
  'frozenHash',
] as const;

const NOW = Date.parse('2026-10-08T12:00:00Z');
const stepUp = () =>
  jsonResponse(
    401,
    apiError('STEP_UP_REQUIRED', {
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    }),
  );

const watchConsole = () =>
  (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );

const everywhere = (
  consoleSpies: readonly { mock: { calls: unknown[][] } }[],
): string =>
  JSON.stringify([
    { ...window.sessionStorage },
    { ...window.localStorage },
    document.cookie,
    window.location.href,
    window.history.state,
    document.title,
    consoleSpies.map((spy) => spy.mock.calls),
  ]);

const environment = (responses: readonly Response[]) => {
  const queue = [...responses];
  return {
    transport: {
      fetcher: vi.fn(async () => queue.shift() as Response),
      documentRef: { cookie: `wj_csrf=${CSRF}` },
    },
    newKey: () => 'idem-key-privacy-001',
    navigate: vi.fn(),
  };
};

describe('what a step-up detour and a preview mint leave behind', () => {
  it('stores only the editable text of a decision, never a hash, manifest or person', async () => {
    const spies = watchConsole();
    const env = environment([stepUp()]);
    const { container } = mountElement(
      <CmsEditorialReviewDetailIsland
        init={{
          review: reviewDetailFixture(),
          reviewId: REVIEW_ID,
          verifiedAt: INSTANT,
        }}
        readReview={async () => ({
          kind: 'ok',
          resource: reviewDetailFixture(),
        })}
        environment={env}
      />,
    );
    await click(
      container.querySelector('input[value="reject"]') as HTMLElement,
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Reason'),
      'Needs work.',
    );
    await click(buttonNamed(container, /Record rejection/u));
    await vi.waitFor(() => expect(env.navigate).toHaveBeenCalledTimes(1));
    const stored = window.sessionStorage.getItem(
      'wj-step-up-draft:cms:/:CMS-03B-06',
    ) as string;
    expect(JSON.parse(stored).values).toEqual({
      decision: 'reject',
      reason: 'Needs work.',
    });
    const seen = everywhere(spies);
    for (const value of SENSITIVE) expect(seen, value).not.toContain(value);
  });

  it('stores no manifest or version set when a schedule and a publish are interrupted', async () => {
    const spies = watchConsole();
    const env = environment([stepUp(), stepUp()]);
    const workflow = approvedWorkflowFixture();
    const { container } = mountElement(
      <CmsEditorialWorkflowIsland
        init={{
          workflow,
          entryId: ENTRY_ID,
          revisionId: null,
          verifiedAt: INSTANT,
        }}
        readWorkflow={async () => ({ kind: 'ok', resource: workflow })}
        environment={{ ...env, storage: () => window.sessionStorage }}
      />,
    );
    const details = container.querySelectorAll('details');
    for (const element of details) (element as HTMLDetailsElement).open = true;
    await React.act(async () => {
      for (const element of details) element.dispatchEvent(new Event('toggle'));
    });
    await vi.waitFor(
      () =>
        expect(
          container.querySelectorAll('datalist option').length,
        ).toBeGreaterThan(100),
      { timeout: 20_000 },
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Local date and time'),
      localInputValue(NOW + 40 * 86_400_000),
    );
    await typeInto(byLabel<HTMLInputElement>(container, 'Time zone'), 'UTC');
    const audiences = container.querySelectorAll<HTMLInputElement>(
      'input[id$="-audience"]',
    );
    for (const audience of audiences) await typeInto(audience, 'members');
    await click(buttonNamed(container, 'Schedule'));
    await click(buttonNamed(container, 'Confirm publish'));
    await vi.waitFor(() => expect(env.navigate).toHaveBeenCalledTimes(2));
    const keys = Object.keys(window.sessionStorage);
    expect(keys.sort()).toEqual([
      'wj-step-up-draft:cms:/:CMS-03B-07',
      'wj-step-up-draft:cms:/:CMS-03B-09',
    ]);
    const seen = everywhere(spies);
    for (const value of SENSITIVE) expect(seen, value).not.toContain(value);
  });

  it('keeps the chosen reviewer out of the draft and every store', async () => {
    const spies = watchConsole();
    const env = environment([stepUp()]);
    const review = reviewDetailFixture({
      permittedNextActions: ['assign_reviewer'],
    });
    const { container } = mountElement(
      <CmsEditorialReviewDetailIsland
        init={{ review, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
        readReview={async () => ({ kind: 'ok', resource: review })}
        loadOptions={async () => ({
          kind: 'ok',
          options: [
            {
              personId: REVIEWER_PERSON_ID,
              endsAt: new Date(NOW + 30 * 86_400_000).toISOString(),
            },
          ],
        })}
        environment={{ ...env, storage: () => window.sessionStorage }}
      />,
    );
    await flush();
    await choose(
      byLabel<HTMLSelectElement>(container, 'Reviewer'),
      REVIEWER_PERSON_ID,
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Assignment ends'),
      localInputValue(Date.now() + 86_400_000),
    );
    await click(buttonNamed(container, 'Assign reviewer'));
    await vi.waitFor(() => expect(env.navigate).toHaveBeenCalledTimes(1));
    expect(Object.keys(window.sessionStorage)).toEqual([
      'wj-step-up-draft:cms:/:CMS-03B-18-create',
    ]);
    const seen = everywhere(spies);
    expect(seen).not.toContain(REVIEWER_PERSON_ID);
  });

  it('never lets a minted preview token reach a store, the URL, history, the title or a log', async () => {
    const spies = watchConsole();
    const testCase = COMMAND_CASES['CMS-03B-08'];
    const env = environment([jsonResponse(201, testCase.resource, {})]);
    const workflow = workflowFixture({ permittedNextActions: ['preview'] });
    const { container } = mountElement(
      <CmsEditorialWorkflowIsland
        init={{
          workflow,
          entryId: ENTRY_ID,
          revisionId: null,
          verifiedAt: INSTANT,
        }}
        readWorkflow={async () => ({ kind: 'ok', resource: workflow })}
        environment={{ ...env, storage: () => window.sessionStorage }}
      />,
    );
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Route'),
      '/music/artist/spring-2026-tour',
    );
    await click(buttonNamed(container, 'Create preview'));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-cms-preview-token]'),
      ).not.toBeNull(),
    );
    expect(container.textContent).toContain(TOKEN);
    expect(everywhere(spies)).not.toContain(TOKEN);
    await click(buttonNamed(container, 'Hide token and create another'));
    expect(container.textContent).not.toContain(TOKEN);
  });
});

describe('what the server-rendered views print', () => {
  it('prints no person, party or ownership identifier in the queue, detail or workflow text', () => {
    const queue = renderToStaticMarkup(
      <CmsEditorialReviewQueue
        page={queuePageFixture([queueItem(1)])}
        routePath="/app/cms-content-modeling/reviews"
        query={{}}
      />,
    );
    const detail = renderToStaticMarkup(
      <CmsEditorialReviewDetailIsland
        init={{
          review: reviewDetailFixture({
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
            permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
          }),
          reviewId: REVIEW_ID,
          verifiedAt: INSTANT,
        }}
      />,
    );
    const workflow = renderToStaticMarkup(
      <CmsEditorialWorkflowIsland
        init={{
          workflow: approvedWorkflowFixture(),
          entryId: ENTRY_ID,
          revisionId: REVISION_ID,
          verifiedAt: INSTANT,
        }}
      />,
    );
    for (const html of [queue, detail, workflow]) {
      expect(html).not.toContain(REVIEWER_PERSON_ID);
      expect(html).not.toContain(ASSIGNMENT_ID);
      expect(html).not.toMatch(
        /\b(?:ownerId|partyId|personId|actorId|submitterId)\b/u,
      );
      expect(html).not.toContain('dependencyManifest');
    }
  });
});

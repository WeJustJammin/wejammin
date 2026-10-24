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
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { COMMAND_CASES } from '../../server/cms-workflow-platform-command.test-support';
import { rateLimitMessage } from '../../lib/safe-read-retry';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import { focusOn, settle } from './cms-workflow-focus.test-support';
import {
  jsonResponse,
  reviewDetailFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';
import {
  mountReviewIsland,
  mountWorkflowIsland,
} from './cms-workflow-island-mount.test-support';
import { readingOf } from './cms-workflow-status.test-support';
import CmsWorkflowRateLimitNotice from './CmsWorkflowRateLimitNotice';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.restoreAllMocks());

const noticeIn = (root: HTMLElement): HTMLElement | null =>
  root.querySelector<HTMLElement>('[data-cms-workflow-rate-limit]');

const limited = <T,>(seconds: number | null): CanonicalReadResult<T> => ({
  kind: 'degraded',
  requestId: null,
  rateLimit: { retryAfterSeconds: seconds },
});

describe('CmsWorkflowRateLimitNotice', () => {
  it('is a polite atomic status region that is empty without a rate limit', () => {
    const { container } = mountElement(
      <CmsWorkflowRateLimitNotice rateLimit={null} />,
    );
    const notice = noticeIn(container);
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.getAttribute('aria-live')).toBe('polite');
    expect(notice?.getAttribute('aria-atomic')).toBe('true');
    expect(readingOf(notice ?? null)).toBe('');
  });

  it('names the stated wait, and asks for a moment when none was stated', () => {
    const shown = mountElement(
      <CmsWorkflowRateLimitNotice rateLimit={{ retryAfterSeconds: 7 }} />,
    );
    expect(readingOf(noticeIn(shown.container))).toBe(rateLimitMessage(7));
    const unstated = mountElement(
      <CmsWorkflowRateLimitNotice rateLimit={{ retryAfterSeconds: null }} />,
    );
    expect(readingOf(noticeIn(unstated.container))).toBe(
      rateLimitMessage(null),
    );
  });
});

describe('the islands announce a rate-limited canonical read', () => {
  it('workflow island: a 429 after a committed command keeps the panel, announces the wait and turns commands off', async () => {
    const testCase = COMMAND_CASES['CMS-03B-05'];
    const { container, readWorkflow } = mountWorkflowIsland(
      workflowFixture(),
      [limited(7)],
      [
        jsonResponse(201, testCase.resource, {
          etag: testCase.etag as string,
          location: testCase.location as string,
        }),
      ],
    );
    expect(readingOf(noticeIn(container))).toBe('');
    await click(focusOn(buttonNamed(container, /Submit for review \(/u)));
    await settle();
    expect(readWorkflow).toHaveBeenCalledTimes(1);
    expect(readingOf(noticeIn(container))).toBe(rateLimitMessage(7));
    expect(
      container.querySelector('[data-cms-workflow-degraded]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-cms-workflow-panel]')).not.toBeNull();
  });

  it('review island: a 429 after a recorded decision announces the wait and keeps the evidence', async () => {
    const decided = COMMAND_CASES['CMS-03B-06'];
    const { container, readReview } = mountReviewIsland(
      reviewDetailFixture(),
      [limited(4)],
      [jsonResponse(200, decided.resource, { etag: decided.etag as string })],
    );
    await click(
      container.querySelector('input[value="approve"]') as HTMLElement,
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Reason'),
      'Matches the brief.',
    );
    await click(buttonNamed(container, /Record approval/u));
    await settle();
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(readingOf(noticeIn(container))).toBe(rateLimitMessage(4));
    expect(
      container.querySelector('[data-cms-workflow-degraded]'),
    ).not.toBeNull();
  });
});

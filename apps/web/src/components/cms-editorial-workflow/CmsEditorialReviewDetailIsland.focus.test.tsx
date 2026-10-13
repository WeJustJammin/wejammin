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
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  COMMAND_CASES,
  REVOKE_CASE,
} from '../../server/cms-workflow-platform-command.test-support';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import { localInputValue } from './cms-workflow-expiry';
import {
  deferred,
  focusOn,
  lostFetcher,
  release,
  settle,
} from './cms-workflow-focus.test-support';
import {
  ASSIGNMENT_ID,
  REVIEWER_PERSON_ID,
  jsonResponse,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';
import {
  mountReviewIsland,
  ok,
} from './cms-workflow-island-mount.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.restoreAllMocks());

type Review = ReturnType<typeof reviewDetailFixture>;
type Read = CanonicalReadResult<Review>;

const DAY = 24 * 3_600_000;
const active = {
  assignmentId: ASSIGNMENT_ID,
  version: '1',
  state: 'active',
  startsAt: '2026-10-08T12:00:00Z',
  endsAt: '2026-10-09T12:00:00Z',
  reviewerLabel: 'Reviewer 1',
};
const owner = (assignments: unknown[] = []) =>
  reviewDetailFixture({
    version: '2',
    permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
    assignments,
  });

const heldRead = () => {
  const pending = deferred<Read>();
  return { pending, readResource: () => pending.promise };
};

/*
 * FE03 / AC-072, AC-037, AC-060: on the review detail a command leaves focus on
 * the activated control until the canonical review has landed, then moves it to
 * the named result heading (assignments after an assign or revoke, decisions
 * after a decision); a refetch alone never moves it.
 */
describe('CmsEditorialReviewDetailIsland focus', () => {
  it('[P2-S11-AC-072] returns focus to the assignments heading after an assign commits and the review is refetched', async () => {
    const { pending, readResource } = heldRead();
    const created = COMMAND_CASES['CMS-03B-18'];
    const { container } = mountReviewIsland(
      owner(),
      [],
      [
        jsonResponse(201, created.resource, {
          etag: created.etag as string,
          location: created.location as string,
        }),
      ],
      {
        readResource,
        loadOptions: async () => ({
          kind: 'ok',
          options: [
            {
              personId: REVIEWER_PERSON_ID,
              endsAt: new Date(Date.now() + 30 * DAY).toISOString(),
            },
          ],
        }),
      },
    );
    await flush();
    await choose(
      byLabel<HTMLSelectElement>(container, 'Reviewer'),
      REVIEWER_PERSON_ID,
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Assignment ends'),
      localInputValue(Date.now() + DAY),
    );
    const assign = focusOn(buttonNamed(container, 'Assign reviewer'));
    await click(assign);
    await settle();
    expect(container.textContent).toContain('Reviewer assigned');
    expect(document.activeElement).toBe(assign);
    await release(pending, ok(owner([active])));
    expect(document.activeElement?.id).toBe('review-assignments-title');
    expect(container.textContent).toContain('Reviewer 1');
  });

  it('[P2-S11-AC-072] returns focus to the assignments heading after a revoke commits and the review is refetched', async () => {
    const { pending, readResource } = heldRead();
    const { container } = mountReviewIsland(
      owner([active]),
      [],
      [
        jsonResponse(200, REVOKE_CASE.resource, {
          etag: REVOKE_CASE.etag as string,
        }),
      ],
      { readResource },
    );
    const revoke = focusOn(buttonNamed(container, 'Revoke Reviewer 1'));
    await click(revoke);
    await settle();
    expect(container.textContent).toContain('Assignment revoked.');
    expect(document.activeElement).toBe(revoke);
    await release(pending, ok(owner([{ ...active, state: 'revoked' }])));
    expect(document.activeElement?.id).toBe('review-assignments-title');
    expect(container.textContent).toContain('Revoked');
  });

  it('[P2-S11-AC-037] keeps focus on Record approval until the read lands, then moves it to the decisions heading only', async () => {
    const { pending, readResource } = heldRead();
    const decided = COMMAND_CASES['CMS-03B-06'];
    const { container } = mountReviewIsland(
      reviewDetailFixture(),
      [],
      [jsonResponse(200, decided.resource, { etag: decided.etag as string })],
      { readResource },
    );
    await click(
      container.querySelector('input[value="approve"]') as HTMLElement,
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
    const record = focusOn(buttonNamed(container, /Record approval/u));
    await click(record);
    await settle();
    expect(container.textContent).toContain('Decision recorded.');
    expect(document.activeElement).toBe(record);
    await release(pending, ok(reviewDetailFixture({ version: '3' })));
    expect(document.activeElement?.id).toBe('review-decisions-title');
  });

  it('[P2-S11-AC-060] keeps focus where the person put it through a reconciling refetch, verified and then degraded', async () => {
    const first = deferred<Read>();
    const second = deferred<Read>();
    const queue = [first, second];
    const { container, readReview } = mountReviewIsland(
      reviewDetailFixture(),
      [],
      [],
      {
        fetcher: lostFetcher(),
        readResource: () => (queue.shift() as typeof first).promise,
      },
    );
    await click(
      container.querySelector('input[value="approve"]') as HTMLElement,
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
    const record = focusOn(buttonNamed(container, /Record approval/u));
    const focusCalls = vi.spyOn(HTMLElement.prototype, 'focus');
    await click(record);
    await settle();
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(record);
    await release(first, ok(reviewDetailFixture()));
    expect(document.activeElement).toBe(record);

    const check = focusOn(buttonNamed(container, 'Check the current state'));
    focusCalls.mockClear();
    await click(check);
    await settle();
    expect(readReview).toHaveBeenCalledTimes(2);
    await release(second, { kind: 'degraded', requestId: null });
    expect(
      container.querySelector('[data-cms-workflow-degraded]'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(check);
    expect(focusCalls).not.toHaveBeenCalled();
  });
});

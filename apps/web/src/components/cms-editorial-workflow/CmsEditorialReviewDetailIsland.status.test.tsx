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
  release,
  settle,
  type Fetcher,
} from './cms-workflow-focus.test-support';
import {
  ASSIGNMENT_ID,
  REVIEWER_PERSON_ID,
  apiError,
  jsonResponse,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';
import {
  formTitles,
  mountReviewIsland,
  ok,
} from './cms-workflow-island-mount.test-support';
import {
  formStatuses,
  islandStatus,
  readingOf,
  regionsReading,
} from './cms-workflow-status.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => vi.restoreAllMocks());

type Read = CanonicalReadResult<ReturnType<typeof reviewDetailFixture>>;

const DAY = 24 * 3_600_000;
const DECIDED = 'Decision recorded.';
const ASSIGNED = /^Reviewer assigned until /u;

const decidedReview = () =>
  reviewDetailFixture({
    version: '3',
    state: 'approved',
    recordedDecisionCount: 1,
    decidedAt: '2026-10-09T12:00:00Z',
    permittedNextActions: [],
    decisions: [
      {
        id: '123e4567-e89b-42d3-a456-426614176002',
        decision: 'approve',
        capability: 'cms.reviewer',
        decidedAt: '2026-10-09T12:00:00Z',
        mine: true,
        reason: 'Matches the brief.',
      },
    ],
    distinctApprovalCount: 1,
  });

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

const decisionAnswer = () => {
  const decided = COMMAND_CASES['CMS-03B-06'];
  return jsonResponse(200, decided.resource, { etag: decided.etag as string });
};

/** A wire that answers each request with the next queued answer, in order. */
const answeringInOrder = (answers: Array<() => Promise<Response>>): Fetcher =>
  vi.fn<Fetcher>(async () => {
    const next = answers.shift();
    if (next === undefined)
      throw new Error('no answer queued for this request');
    return next();
  });

const fillDecision = async (container: HTMLElement) => {
  await click(container.querySelector('input[value="approve"]') as HTMLElement);
  await typeInto(
    byLabel<HTMLTextAreaElement>(container, 'Reason'),
    'Matches the brief.',
  );
};

const assignAnswer = () => {
  const created = COMMAND_CASES['CMS-03B-18'];
  return jsonResponse(201, created.resource, {
    etag: created.etag as string,
    location: created.location as string,
  });
};

const reviewers = async () => ({
  kind: 'ok' as const,
  options: [
    {
      personId: REVIEWER_PERSON_ID,
      endsAt: new Date(Date.now() + 30 * DAY).toISOString(),
    },
  ],
});

const fillAssignment = async (container: HTMLElement) => {
  await flush();
  await choose(
    byLabel<HTMLSelectElement>(container, 'Reviewer'),
    REVIEWER_PERSON_ID,
  );
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Assignment ends'),
    localInputValue(Date.now() + DAY),
  );
};

/*
 * FE03 CMS-08 rows ("announce exact decision/state", "focus stays until named
 * result heading", "server after success"): the polite confirmation of a command
 * must survive the canonical refetch that removes the form which produced it. It
 * lives in one polite atomic status line owned by the island, is announced once,
 * and stays until the next command or navigation.
 */
describe('CmsEditorialReviewDetailIsland confirmation', () => {
  it('[P2-S11-AC-037] keeps one polite status line mounted outside every form before any command', () => {
    const { container } = mountReviewIsland(reviewDetailFixture());
    const status = islandStatus(container);
    expect(status).not.toBeNull();
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-atomic')).toBe('true');
    expect(status?.closest('[data-cms-workflow-form]')).toBeNull();
    expect(readingOf(status)).toBe('');
  });

  it('[P2-S11-AC-037] still reads "Decision recorded." after the refetch removed the decision form, announced once', async () => {
    const { container, readReview } = mountReviewIsland(
      reviewDetailFixture(),
      [ok(decidedReview())],
      [decisionAnswer()],
    );
    const before = islandStatus(container) as HTMLElement;
    const written: MutationRecord[] = [];
    const writes = new MutationObserver((batch) => written.push(...batch));
    writes.observe(before, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    await fillDecision(container);
    await click(buttonNamed(container, /Record approval/u));
    await vi.waitFor(() =>
      expect(document.activeElement?.id).toBe('review-decisions-title'),
    );
    expect(readReview).toHaveBeenCalledTimes(1);
    // Announced once: the line was written once, and the refetch rewrote nothing.
    written.push(...writes.takeRecords());
    expect(written).toHaveLength(1);
    writes.disconnect();
    // The form that produced the confirmation is gone...
    expect(formTitles(container)).toEqual([]);
    // ...and the confirmation is not: one live region reads it, and it is the
    // region that was mounted before the command, never a new element.
    const reading = regionsReading(container, DECIDED);
    expect(reading).toHaveLength(1);
    expect(reading[0]).toBe(before);
    expect(reading[0]?.isConnected).toBe(true);
    expect(reading[0]?.closest('[data-cms-workflow-form]')).toBeNull();
    expect(reading[0]?.contains(document.activeElement)).toBe(false);
    expect(container.textContent?.split(DECIDED).length).toBe(2);
  });

  it('[P2-S11-AC-037] keeps the confirmation in the island line while the refetch is in flight, not in the form as well', async () => {
    const read = deferred<Read>();
    const { container } = mountReviewIsland(
      reviewDetailFixture(),
      [],
      [decisionAnswer()],
      { readResource: () => read.promise },
    );
    await fillDecision(container);
    const record = focusOn(buttonNamed(container, /Record approval/u));
    await click(record);
    await settle();
    expect(document.activeElement).toBe(record);
    expect(regionsReading(container, DECIDED)).toHaveLength(1);
    expect(formStatuses(container)).toEqual([]);
    await release(read, ok(decidedReview()));
    expect(regionsReading(container, DECIDED)).toHaveLength(1);
  });

  it('[P2-S11-AC-037] says nothing in the island line while the outcome is unknown, then confirms once after the retry commits', async () => {
    const answers: Array<() => Promise<Response>> = [
      () => Promise.reject(new TypeError('Failed to fetch')),
      async () => decisionAnswer(),
    ];
    const fetcher = answeringInOrder(answers);
    const { container } = mountReviewIsland(
      reviewDetailFixture(),
      [ok(reviewDetailFixture()), ok(decidedReview())],
      [],
      { fetcher },
    );
    await fillDecision(container);
    await click(buttonNamed(container, /Record approval/u));
    await settle();
    expect(readingOf(islandStatus(container))).toBe('');
    expect(formStatuses(container)).toEqual([
      'The current state is loaded. You can retry the same request.',
    ]);
    await click(buttonNamed(container, 'Retry the same request'));
    await settle();
    await vi.waitFor(() => expect(formTitles(container)).toEqual([]));
    expect(regionsReading(container, DECIDED)).toHaveLength(1);
    expect(formStatuses(container)).toEqual([]);
  });

  it('[P2-S11-AC-072] keeps "Reviewer assigned" through the refetch and replaces it when the next command begins', async () => {
    const revoked = deferred<Response>();
    const answers: Array<() => Promise<Response>> = [
      async () => assignAnswer(),
      () => revoked.promise,
    ];
    const fetcher = answeringInOrder(answers);
    const { container } = mountReviewIsland(
      owner(),
      [ok(owner([active])), ok(owner([{ ...active, state: 'revoked' }]))],
      [],
      { fetcher, loadOptions: reviewers },
    );
    await fillAssignment(container);
    await click(buttonNamed(container, 'Assign reviewer'));
    await vi.waitFor(() =>
      expect(document.activeElement?.id).toBe('review-assignments-title'),
    );
    const assigned = regionsReading(container, ASSIGNED);
    expect(assigned).toHaveLength(1);
    const line = islandStatus(container);
    expect(assigned[0]).toBe(line);

    // The next command, held in flight: the old confirmation is withdrawn at once.
    await click(buttonNamed(container, 'Revoke Reviewer 1'));
    await settle();
    expect(regionsReading(container, ASSIGNED)).toHaveLength(0);
    expect(readingOf(line)).toBe('');
    expect(formStatuses(container)).toContain('Revoking assignment…');

    await release(
      revoked,
      jsonResponse(200, REVOKE_CASE.resource, {
        etag: REVOKE_CASE.etag as string,
      }),
    );
    expect(regionsReading(container, 'Assignment revoked.')).toEqual([line]);
    expect(regionsReading(container, ASSIGNED)).toHaveLength(0);
  });

  it('[P2-S11-AC-072] withdraws "Reviewer assigned" when the person starts another assignment', async () => {
    const { container } = mountReviewIsland(
      owner(),
      [ok(owner([active]))],
      [assignAnswer()],
      { loadOptions: reviewers },
    );
    await fillAssignment(container);
    await click(buttonNamed(container, 'Assign reviewer'));
    await settle();
    expect(regionsReading(container, ASSIGNED)).toHaveLength(1);
    await click(buttonNamed(container, 'Assign another reviewer'));
    expect(regionsReading(container, ASSIGNED)).toHaveLength(0);
    expect(readingOf(islandStatus(container))).toBe('');
  });

  it('[P2-S11-AC-037] leaves the island line empty when a decision is refused', async () => {
    const { container } = mountReviewIsland(
      reviewDetailFixture(),
      [],
      [
        jsonResponse(
          409,
          apiError('CONFLICT', { reasonCode: 'review_not_open' }),
        ),
      ],
    );
    await fillDecision(container);
    await click(buttonNamed(container, /Record approval/u));
    await settle();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(readingOf(islandStatus(container))).toBe('');
  });
});

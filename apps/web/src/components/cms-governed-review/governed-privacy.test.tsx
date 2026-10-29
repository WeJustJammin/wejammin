// @vitest-environment jsdom
import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { GovernedReviewDetailResource } from '@wejammin/contracts';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  INSTANT,
  LATER,
  REVIEW_ID,
  governedAssignmentSummaryFixture,
  governedDecisionFixture,
  governedDetailFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CanonicalReadResult } from '../cms-editorial-workflow/cms-workflow-canonical-read';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import {
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

/**
 * FE03 895: decision reasons, the policy basis and every assignment identifier "are re-derived by
 * the server and never enter a public/private cache, analytics event, Realtime body, URL, or log".
 * The detail island is driven through a real decision with sentinel values; the sweep then looks at
 * every browser channel a value could leave through.
 */
const REASON = 'sentinel-reason-9c41';
const POLICY_HASH = 'a1b2c3d4'.repeat(8);
const ASSIGNMENT_ID = '123e4567-e89b-42d3-a456-426614174fa1';
const SENTINELS = [REASON, POLICY_HASH, ASSIGNMENT_ID];

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

type Read = CanonicalReadResult<GovernedReviewDetailResource>;
const detail = (overrides: Record<string, unknown> = {}) =>
  governedDetailFixture({
    policyBasisHash: POLICY_HASH,
    permittedNextActions: ['record_decision', 'revoke_assignment'],
    assignments: [
      governedAssignmentSummaryFixture({ assignmentId: ASSIGNMENT_ID }),
    ],
    ...overrides,
  });

describe('governed detail island privacy sweep (browser)', () => {
  it('[P2-S12-AC-272] a decision with a sentinel reason leaves the browser only in the POST body: no URL, history, storage, broadcast, Realtime, beacon or console carries a sentinel', async () => {
    const consoleCalls: unknown[][] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        consoleCalls.push(args);
      });
    const channel = vi.fn();
    const socket = vi.fn();
    const stream = vi.fn();
    const beacon = vi.fn();
    vi.stubGlobal('BroadcastChannel', channel);
    vi.stubGlobal('WebSocket', socket);
    vi.stubGlobal('EventSource', stream);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beacon,
      configurable: true,
    });
    const location = window.location.href;
    const history = window.history.length;
    const draft = new MemoryStorage();

    const after = detail({
      version: '3',
      state: 'approved',
      decidedAt: LATER,
      recordedDecisionCount: 1,
      permittedNextActions: [],
      subjectState: 'approved',
      distinctApprovalCount: 1,
      decisions: [governedDecisionFixture({ mine: true, reason: REASON })],
    });
    const reads: Read[] = [
      { kind: 'ok', resource: after },
      { kind: 'ok', resource: after },
    ];
    const fetcher = queuedFetcher([
      jsonResponse(
        200,
        governedReviewFixture({
          version: '3',
          state: 'approved',
          recordedDecisionCount: 1,
          decidedAt: LATER,
          policyBasisHash: POLICY_HASH,
        }),
        { etag: '"3"' },
      ),
    ]);
    const { container } = mountElement(
      <CmsGovernedReviewDetailIsland
        init={{
          review: detail({ version: '2' }),
          reviewId: REVIEW_ID,
          verifiedAt: INSTANT,
        }}
        readReview={vi.fn(async () => reads.shift() as Read)}
        loadOptions={async () => ({ kind: 'ok', options: [] })}
        environment={governedEnvironment(fetcher, draft)}
      />,
    );
    await flush();
    await click(
      container.querySelector<HTMLInputElement>(
        'input[value="approve"]',
      ) as HTMLInputElement,
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), REASON);
    await click(buttonNamed(container, /Record/u));
    await flush();

    // The reason travelled: it is in the one POST body, and only there.
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(String(init.body)).toContain(REASON);
    expect(url).toBe(`/api/v1/cms/governed-reviews/${REVIEW_ID}/decision`);
    for (const sentinel of SENTINELS) {
      expect(url).not.toContain(sentinel);
      expect(JSON.stringify([...new Headers(init.headers)])).not.toContain(
        sentinel,
      );
      expect(window.location.href).not.toContain(sentinel);
      expect(JSON.stringify(consoleCalls)).not.toContain(sentinel);
    }
    expect(window.location.href).toBe(location);
    expect(window.history.length).toBe(history);
    // The tab-scoped draft store is only for a step-up detour; a verified success leaves it empty.
    expect(draft.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(channel).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  governedApiError,
  governedDetailFixture,
  governedReviewFixture,
  INSTANT,
  LATER,
  REVIEW_ID,
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
import {
  installLazyIntent,
  resetLazyIntentForTest,
} from '../cms-editorial-workflow/cms-lazy-intent';
import { selectViewOnIntent } from '../cms-editorial-workflow/cms-lazy-view';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import { governedAnswerImporters } from './governed-answer-machinery';
import {
  flushUntil,
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

/*
 * The governed stems of the exemption list of the bundle gate (`CMS_ON_DEMAND_CHUNKS`), one test
 * each: the four command forms load on a person's pointer, touch, focus or key in their region and
 * on nothing else (a scroll, a resize, the passing of time, the size of the viewport), and the
 * command machinery loads on a focus or a send. No test support that preloads the modules is
 * imported, so a request is a request.
 */
const asked: string[] = [];
const real = { ...governedAnswerImporters };

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  asked.length = 0;
  installLazyIntent();
  for (const key of ['transport', 'refusal', 'canonicalRead'] as const)
    governedAnswerImporters[key] = (() => {
      asked.push(key);
      return real[key]();
    }) as never;
});
afterEach(() => {
  Object.assign(governedAnswerImporters, real);
  resetLazyIntentForTest();
  document.body.replaceChildren();
});

const viewSource = (file: string): string =>
  readFileSync(resolve(import.meta.dirname, file), 'utf8').replace(
    /\s+/gu,
    ' ',
  );

const NOT_INTENT = ['scroll', 'resize', 'load', 'visibilitychange'] as const;
const INTENT = [
  'pointerover',
  'pointerdown',
  'touchstart',
  'focusin',
  'keydown',
];

/** The form's view as the browser builds it: a lazy view behind the intent of its region. */
const proveIntentOnly = async (
  stem: string,
  region: string,
  views: string,
): Promise<void> => {
  // The view module hands the stem's chunk to the region's intent and to nothing else.
  expect(viewSource(views)).toContain(
    `loadViewOnIntent( '${region}', () => import('./${stem}'), )`,
  );
  for (const type of INTENT) {
    resetLazyIntentForTest();
    installLazyIntent();
    document.body.replaceChildren();
    const host = document.createElement('section');
    host.setAttribute('data-cms-lazy-region', region);
    host.innerHTML = '<button type="button" id="inside">x</button>';
    document.body.appendChild(host);
    const loads = vi.fn(async () => ({ default: () => null }));
    vi.useFakeTimers();
    const view = await selectViewOnIntent(false, region, loads);
    const { unmount } = mountElement(
      <React.Suspense fallback={null}>
        {React.createElement(view)}
      </React.Suspense>,
    );
    for (const quiet of NOT_INTENT) window.dispatchEvent(new Event(quiet));
    document.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(120_000);
    vi.useRealTimers();
    await flush();
    expect(loads, `${type}: nothing but intent`).not.toHaveBeenCalled();
    host
      .querySelector('#inside')!
      .dispatchEvent(new Event(type, { bubbles: true }));
    await flushUntil(() => loads.mock.calls.length > 0);
    expect(loads, type).toHaveBeenCalledTimes(1);
    unmount();
  }
};

describe('the governed command forms', () => {
  it('CmsGovernedSubmitForm: loads on intent in the panel region and on nothing else', async () => {
    await proveIntentOnly(
      'CmsGovernedSubmitForm',
      'governed-submit',
      'governed-panel-form-views.ts',
    );
  });

  it('CmsGovernedDecisionForm: loads on intent in the decision region and on nothing else', async () => {
    await proveIntentOnly(
      'CmsGovernedDecisionForm',
      'governed-decision',
      'governed-review-form-views.ts',
    );
  });

  it('CmsGovernedAssignmentForm: loads on intent in the assignment region and on nothing else', async () => {
    await proveIntentOnly(
      'CmsGovernedAssignmentForm',
      'governed-assignment',
      'governed-review-form-views.ts',
    );
  });

  it('CmsGovernedActivationForm: loads on intent in the activation region and on nothing else', async () => {
    await proveIntentOnly(
      'CmsGovernedActivationForm',
      'governed-activation',
      'governed-review-form-views.ts',
    );
  });
});

const mountIsland = (responses: readonly Response[]) => {
  const fetcher = queuedFetcher(responses);
  const initial = governedDetailFixture({ version: '2' });
  const mounted = mountElement(
    <CmsGovernedReviewDetailIsland
      init={{ review: initial, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
      loadOptions={async () => ({ kind: 'ok', options: [] })}
      environment={governedEnvironment(fetcher)}
    />,
  );
  return { ...mounted, fetcher };
};

const decide = async (container: HTMLElement): Promise<void> => {
  await click(
    container.querySelector<HTMLInputElement>(
      'input[value="approve"]',
    ) as HTMLInputElement,
  );
  await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
  await click(buttonNamed(container, /Record/u));
};

describe('the governed command machinery', () => {
  it('governed-review-command-transport: not requested by a mount; requested when a form takes focus', async () => {
    const { container } = mountIsland([]);
    await flush();
    await flush();
    expect(asked).toEqual([]);
    container
      .querySelector('[data-cms-workflow-form] textarea')!
      .dispatchEvent(new Event('focusin', { bubbles: true }));
    await flush();
    expect(asked).toContain('transport');
  });

  it('governed-review-refusal: not requested by a mount or a send that commits; requested by a focus or a refused send', async () => {
    const refused = mountIsland([
      jsonResponse(409, governedApiError('CONFLICT', 'x', {})),
    ]);
    await flush();
    expect(asked).toEqual([]);
    await decide(refused.container);
    await flushUntil(() => asked.includes('refusal'));
    expect(asked).toContain('refusal');
  });

  it('governed-review-canonical-read: not requested by a mount, a focus or a refused send; requested by the refetch a commit starts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    const decided = jsonResponse(
      200,
      governedReviewFixture({
        version: '3',
        state: 'approved',
        recordedDecisionCount: 1,
        decidedAt: LATER,
      }),
      { etag: '"3"' },
    );
    const { container } = mountIsland([decided]);
    await flush();
    container
      .querySelector('[data-cms-workflow-form] textarea')!
      .dispatchEvent(new Event('focusin', { bubbles: true }));
    await flush();
    await flush();
    expect(asked).not.toContain('canonicalRead');
    await decide(container);
    await flushUntil(() => asked.includes('canonicalRead'));
    expect(asked).toContain('canonicalRead');
    vi.unstubAllGlobals();
  });
});

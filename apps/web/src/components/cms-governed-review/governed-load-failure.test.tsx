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

import { MODULE_UNAVAILABLE_COPY } from '../../lib/module-unavailable';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import {
  HASH_A,
  SUBJECT_ID,
  governedApiError,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedSubmitForm from './CmsGovernedSubmitForm';
import {
  governedAnswerImporters,
  readGovernedReviewLazily,
} from './governed-answer-machinery';
import {
  flushUntil,
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

/*
 * A failed fetch of a chunk a governed form loads on an action surfaces as "nothing was sent" (or a
 * fixed refusal sentence), leaves the form usable and lets the next action import again.
 */
beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
afterAll(disableReactAct);

const real = { ...governedAnswerImporters };
afterEach(() => {
  Object.assign(governedAnswerImporters, real);
});

const offline = (): TypeError =>
  new TypeError('Failed to fetch dynamically imported module');

/**
 * An importer that rejects while the network is down and loads once it is back. A press warms the
 * transport on focus as well as sending, so "fails once" would be spent by the warm-up.
 */
const flaky = <T,>(load: () => Promise<T>) => {
  let down = true;
  const importer = vi.fn(async () => {
    if (down) throw offline();
    return load();
  });
  return {
    importer,
    heal: () => {
      down = false;
    },
  };
};

const mount = (responses: readonly Response[]) => {
  const fetcher = queuedFetcher(responses);
  const refetch = vi.fn(async () => true);
  const onCommitted = vi.fn();
  const { container } = mountElement(
    <CmsGovernedSubmitForm
      subject={{
        kind: 'template_version',
        id: SUBJECT_ID,
        hash: HASH_A,
        key: 'profile-header',
        version: 2,
        state: 'draft',
      }}
      showForm
      disabledReason={null}
      refetch={refetch}
      onCommitted={onCommitted}
      environment={governedEnvironment(fetcher)}
    />,
  );
  return { container, fetcher, refetch, onCommitted };
};

const submit = (container: HTMLElement) =>
  buttonNamed(container, 'Submit for review');
const created = () =>
  jsonResponse(201, governedReviewFixture({ version: '1' }), { etag: '"1"' });

describe('the governed command transport chunk fails to load', () => {
  it('says nothing was sent, keeps the form usable, and the next press imports again and sends', async () => {
    const transport = flaky(real.transport);
    governedAnswerImporters.transport = transport.importer;
    const { container, fetcher, onCommitted } = mount([created()]);

    await click(submit(container));
    await flushUntil(() => container.querySelector('[role="alert"]') !== null);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      MODULE_UNAVAILABLE_COPY,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(submit(container).getAttribute('aria-busy')).not.toBe('true');

    transport.heal();
    const importsBefore = transport.importer.mock.calls.length;
    await click(submit(container));
    await flushUntil(() => onCommitted.mock.calls.length > 0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(transport.importer.mock.calls.length).toBeGreaterThan(importsBefore);
  });
});

describe('the governed refusal classifier chunk fails to load', () => {
  it('still shows a fixed refusal sentence and the next press sends again', async () => {
    const refusal = flaky(real.refusal);
    governedAnswerImporters.refusal = refusal.importer;
    const { container, fetcher, onCommitted } = mount([
      jsonResponse(409, governedApiError('CONFLICT', 'x', {})),
      created(),
    ]);

    await click(submit(container));
    await flushUntil(() => container.querySelector('[role="alert"]') !== null);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'was refused',
    );
    expect(submit(container).getAttribute('aria-busy')).not.toBe('true');

    refusal.heal();
    await click(submit(container));
    await flushUntil(() => onCommitted.mock.calls.length > 0);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('the governed canonical read chunk fails to load', () => {
  it('answers degraded instead of rejecting, and the next read imports again', async () => {
    governedAnswerImporters.canonicalRead = vi
      .fn<typeof real.canonicalRead>()
      .mockRejectedValueOnce(offline())
      .mockImplementation(real.canonicalRead);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    expect(await readGovernedReviewLazily(SUBJECT_ID)).toEqual({
      kind: 'degraded',
      requestId: null,
    });
    expect((await readGovernedReviewLazily(SUBJECT_ID)).kind).not.toBe(
      'degraded',
    );
    expect(governedAnswerImporters.canonicalRead).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});

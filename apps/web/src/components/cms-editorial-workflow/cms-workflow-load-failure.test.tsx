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
import {
  COMMAND_CASES,
  CSRF,
} from '../../server/cms-workflow-platform-command.test-support';
import { flushUntil } from '../cms-governed-review/governed-review-form-test-support';
import CmsEditorialReviewSubmitForm from './CmsEditorialReviewSubmitForm';
import {
  answerImporters,
  readWorkflowLazily,
} from './cms-workflow-answer-machinery';
import { preloadWorkflowAnswerMachinery } from './cms-workflow-answer-machinery.test-support';
import {
  ENTRY_ID,
  REVISION_ID,
  apiError,
  jsonResponse,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';

/*
 * A failed fetch of a lazily loaded chunk (a stale tab after a deploy, a dropped connection) must
 * surface as the state the surface already has for "nothing was sent", leave the form usable and
 * let the next action try the import again; it must never leave the command pending or remember
 * the failure. Each importer below rejects once and then loads.
 */
beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
afterAll(disableReactAct);

const real = { ...answerImporters };
afterEach(() => {
  Object.assign(answerImporters, real);
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

const KEY = 'idem-key-submit-0001';

const mount = (responses: readonly Response[]) => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const { container } = mountElement(
    <CmsEditorialReviewSubmitForm
      entryId={ENTRY_ID}
      entryVersion="7"
      revisionId={REVISION_ID}
      preparation={workflowFixture().preparation!}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => null,
        navigate: () => undefined,
      }}
    />,
  );
  return { container, fetcher, refetch, onDone };
};

const created = () => {
  const testCase = COMMAND_CASES['CMS-03B-05'];
  return jsonResponse(201, testCase.resource, {
    etag: testCase.etag as string,
    location: testCase.location as string,
  });
};

const submitButton = (container: HTMLElement) =>
  buttonNamed(container, /Submit for review/u);

describe('the workflow command transport chunk fails to load', () => {
  it('says nothing was sent, keeps the form usable, and the next press imports again and sends', async () => {
    const transport = flaky(real.transport);
    answerImporters.transport = transport.importer;
    const { container, fetcher, refetch } = mount([created()]);

    await click(submitButton(container));
    await flushUntil(() => container.querySelector('[role="alert"]') !== null);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(MODULE_UNAVAILABLE_COPY);
    expect(fetcher).not.toHaveBeenCalled();
    expect(submitButton(container).getAttribute('aria-busy')).not.toBe('true');

    transport.heal();
    const importsBefore = transport.importer.mock.calls.length;
    await click(submitButton(container));
    await flushUntil(() => fetcher.mock.calls.length > 0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(transport.importer.mock.calls.length).toBeGreaterThan(importsBefore);
    await flushUntil(() => refetch.mock.calls.length > 0);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('the workflow refusal classifier chunk fails to load', () => {
  it('still shows a fixed refusal sentence, keeps the form usable, and the next press sends again', async () => {
    const refusal = flaky(real.refusal);
    answerImporters.refusal = refusal.importer;
    const { container, fetcher } = mount([
      jsonResponse(409, apiError('CONFLICT', { reasonCode: 'x' })),
      created(),
    ]);

    await click(submitButton(container));
    await flushUntil(() => container.querySelector('[role="alert"]') !== null);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('was refused');
    expect(alert?.textContent).not.toContain('A fixed message.');
    expect(submitButton(container).getAttribute('aria-busy')).not.toBe('true');

    refusal.heal();
    await click(submitButton(container));
    await flushUntil(() => fetcher.mock.calls.length > 1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('the workflow canonical read chunk fails to load', () => {
  it('answers degraded instead of rejecting, and the next read imports again', async () => {
    answerImporters.canonicalRead = vi
      .fn<typeof real.canonicalRead>()
      .mockRejectedValueOnce(offline())
      .mockImplementation(real.canonicalRead);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    const first = await readWorkflowLazily(ENTRY_ID, null);
    expect(first).toEqual({ kind: 'degraded', requestId: null });
    const second = await readWorkflowLazily(ENTRY_ID, null);
    expect(second.kind).not.toBe('degraded');
    expect(answerImporters.canonicalRead).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});

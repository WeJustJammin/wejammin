// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
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
import { COMMAND_CASES } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialDecisionForm from './CmsEditorialDecisionForm';
import CmsEditorialPreviewForm from './CmsEditorialPreviewForm';
import CmsEditorialReviewSubmitForm from './CmsEditorialReviewSubmitForm';
import {
  bodyAt,
  environmentFor,
  keyAt,
  lostAnswer,
  queueOf,
  refusalKind,
  staleCandidate,
} from './cms-workflow-input-retention.test-support';
import {
  ENTRY_ID,
  REVIEW_ID,
  REVISION_ID,
  apiError,
  jsonResponse,
  previewResourceFixture,
  reviewDetailFixture,
  versionSetFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';

/*
 * FE03 "Map exact ApiError; retain input; ... reconcile unknown mutation before
 * retry" (P2-S11-AC-037, AC-043). A refusal or a lost answer must never cost the
 * person what they typed. For the decision and preview forms these specs enter
 * values, drive a real definite refusal (a stale candidate or a changed review)
 * and a real unknown outcome (504), and assert the controls STILL HOLD exactly
 * what was entered, then press the commit control again and assert the second
 * request carries the same entries. The submit form has no typed input at all:
 * what it sends is the served preparation, so its spec asserts that the identical
 * preparation is sent again. The schedule and publish forms are in
 * cms-workflow-input-retention-time.test.tsx.
 */

beforeAll(enableReactAct);
// The form checks run synchronously once the lazily loaded validators are in.
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
// jsdom work is slow on a loaded host; waits are conditions, not budgets.
vi.setConfig({ testTimeout: 90_000 });

/* --------------------------------- decision -------------------------------- */

const mountDecision = (responses: readonly Response[]) => {
  const fetcher = queueOf(responses);
  const refetch = vi.fn(async () => true);
  const mounted = mountElement(
    <CmsEditorialDecisionForm
      review={reviewDetailFixture({ version: '2' })}
      disabledReason={null}
      refetch={refetch}
      onDone={vi.fn()}
      environment={environmentFor(fetcher, new MemoryStorage())}
    />,
  );
  return { ...mounted, fetcher, refetch };
};

const enterDecision = async (container: HTMLElement) => {
  await click(
    container.querySelector(
      'input[type="radio"][value="reject"]',
    ) as HTMLElement,
  );
  await typeInto(
    byLabel<HTMLTextAreaElement>(container, 'Reason'),
    'Needs a clearer headline.',
  );
};

const decisionControls = (container: HTMLElement) => ({
  reject: container.querySelector<HTMLInputElement>(
    'input[type="radio"][value="reject"]',
  )?.checked,
  approve: container.querySelector<HTMLInputElement>(
    'input[type="radio"][value="approve"]',
  )?.checked,
  reason: byLabel<HTMLTextAreaElement>(container, 'Reason').value,
});

describe('CMS-03B-06 decision form keeps its entries', () => {
  it('[P2-S11-AC-037] keeps the chosen decision and the typed reason after a definite 409 refusal and re-sends them', async () => {
    const committed = COMMAND_CASES['CMS-03B-06'];
    const { container, fetcher, refetch } = mountDecision([
      jsonResponse(
        409,
        apiError('CONFLICT', { reasonCode: 'dependency_changed' }),
      ),
      jsonResponse(200, committed.resource, { etag: committed.etag as string }),
    ]);
    await enterDecision(container);
    await click(buttonNamed(container, /Record/u));
    await flush();

    expect(refusalKind(container)).toBe('refetch');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(decisionControls(container)).toEqual({
      reject: true,
      approve: false,
      reason: 'Needs a clearer headline.',
    });

    await click(buttonNamed(container, /Record/u));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(bodyAt(fetcher, 1)).toMatchObject({
      reviewId: REVIEW_ID,
      decision: 'reject',
      reason: 'Needs a clearer headline.',
      expectedVersion: '2',
    });
  });

  it('[P2-S11-AC-037] keeps the chosen decision and the typed reason through an unknown outcome and re-sends them under the same key', async () => {
    const committed = COMMAND_CASES['CMS-03B-06'];
    const { container, fetcher } = mountDecision([
      lostAnswer(),
      jsonResponse(200, committed.resource, { etag: committed.etag as string }),
    ]);
    await enterDecision(container);
    await click(buttonNamed(container, /Record/u));
    await flush();

    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('The current state is loaded. You can retry the same request.');
    expect(decisionControls(container)).toEqual({
      reject: true,
      approve: false,
      reason: 'Needs a clearer headline.',
    });
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(keyAt(fetcher, 1)).toBe(keyAt(fetcher, 0));
  });
});

/* ---------------------------------- submit ---------------------------------- */

describe('CMS-03B-05 submit form re-sends the served preparation unchanged', () => {
  const mountSubmit = (responses: readonly Response[]) => {
    const fetcher = queueOf(responses);
    const refetch = vi.fn(async () => true);
    const mounted = mountElement(
      <CmsEditorialReviewSubmitForm
        entryId={ENTRY_ID}
        entryVersion="7"
        revisionId={REVISION_ID}
        preparation={workflowFixture().preparation!}
        disabledReason={null}
        refetch={refetch}
        onDone={vi.fn()}
        environment={environmentFor(fetcher, new MemoryStorage())}
      />,
    );
    return { ...mounted, fetcher };
  };

  it('[P2-S11-AC-037] has no typed input to lose, and a definite refusal leaves the same preparation to send again', async () => {
    const created = COMMAND_CASES['CMS-03B-05'];
    const { container, fetcher } = mountSubmit([
      jsonResponse(
        409,
        apiError('CONFLICT', { reasonCode: 'revision_not_submittable' }),
      ),
      jsonResponse(201, created.resource, {
        etag: created.etag as string,
        location: created.location as string,
      }),
    ]);
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(
      0,
    );
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    expect(refusalKind(container)).toBe('refetch');
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(
      0,
    );
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(bodyAt(fetcher, 1)).toMatchObject({
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      frozenHash: workflowFixture().preparation!.frozenHash,
    });
  });

  it('[P2-S11-AC-037] re-sends the same request under the same key after an unknown outcome', async () => {
    const created = COMMAND_CASES['CMS-03B-05'];
    const { container, fetcher } = mountSubmit([
      lostAnswer(),
      jsonResponse(201, created.resource, {
        etag: created.etag as string,
        location: created.location as string,
      }),
    ]);
    await click(buttonNamed(container, /Submit for review/u));
    await flush();
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(keyAt(fetcher, 1)).toBe(keyAt(fetcher, 0));
  });
});

/* ---------------------------------- preview --------------------------------- */

describe('CMS-03B-08 preview form keeps its entries', () => {
  const mountPreview = (responses: readonly Response[]) => {
    const fetcher = queueOf(responses);
    const refetch = vi.fn(async () => true);
    const mounted = mountElement(
      <CmsEditorialPreviewForm
        entryId={ENTRY_ID}
        entryVersion="7"
        revisionId={REVISION_ID}
        locale="en-US"
        versionSet={versionSetFixture as never}
        disabledReason={null}
        refetch={refetch}
        copyText={vi.fn(async () => undefined)}
        environment={environmentFor(fetcher, new MemoryStorage())}
      />,
    );
    return { ...mounted, fetcher, refetch };
  };
  const enterPreview = async (container: HTMLElement) => {
    await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), 'members');
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Route'),
      '/music/artist/spring-2026-tour',
    );
  };
  const previewControls = (container: HTMLElement) => ({
    audience: byLabel<HTMLInputElement>(container, 'Audience').value,
    route: byLabel<HTMLInputElement>(container, 'Route').value,
  });
  const ENTERED_PREVIEW = {
    audience: 'members',
    route: '/music/artist/spring-2026-tour',
  };

  it('[P2-S11-AC-043] keeps the audience and route after a definite 409 refusal and re-sends them', async () => {
    const { container, fetcher, refetch } = mountPreview([
      staleCandidate(),
      jsonResponse(201, previewResourceFixture({}), {}),
    ]);
    await enterPreview(container);
    await click(buttonNamed(container, 'Create preview'));
    await flush();

    expect(refusalKind(container)).toBe('refetch');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(previewControls(container)).toEqual(ENTERED_PREVIEW);
    await click(buttonNamed(container, 'Create preview'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(bodyAt(fetcher, 1)).toMatchObject(ENTERED_PREVIEW);
  });

  it('[P2-S11-AC-043] keeps the audience and route through an unknown outcome and re-sends them under the same key', async () => {
    const { container, fetcher } = mountPreview([
      lostAnswer(),
      jsonResponse(201, previewResourceFixture({}), {}),
    ]);
    await enterPreview(container);
    await click(buttonNamed(container, 'Create preview'));
    await flush();
    expect(previewControls(container)).toEqual(ENTERED_PREVIEW);
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyAt(fetcher, 1)).toEqual(bodyAt(fetcher, 0));
    expect(keyAt(fetcher, 1)).toBe(keyAt(fetcher, 0));
  });
});

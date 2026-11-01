// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

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
import {
  LATER,
  governedDetailFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedDecisionForm from './CmsGovernedDecisionForm';
import { heldWire } from './governed-command-states.test-support';
import {
  flushUntil,
  governedEnvironment,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const decided = () =>
  jsonResponse(
    200,
    governedReviewFixture({
      version: '3',
      state: 'approved',
      recordedDecisionCount: 1,
      decidedAt: LATER,
    }),
    { etag: '"3"' },
  );
const reason = (c: HTMLElement) => byLabel<HTMLTextAreaElement>(c, 'Reason');
const radio = (c: HTMLElement, v: 'approve' | 'reject') =>
  c.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${v}"]`,
  ) as HTMLInputElement;
const record = (c: HTMLElement) => buttonNamed(c, /Record/u);

/**
 * [P2-S12-AC-271] FE03 1046: the fields stay editable while the decision is in flight, so a value typed meanwhile
 * survives its completion; what was sent is cleared (the late-edit rule).
 */
describe('CmsGovernedDecisionForm: text typed while the decision is in flight', () => {
  it('[P2-S12-AC-271] commandState success: a reason typed after dispatch is kept and the chosen decision that was sent is cleared', async () => {
    const wire = heldWire();
    const refetch = vi.fn(async () => true);
    const { container } = mountElement(
      <CmsGovernedDecisionForm
        review={governedDetailFixture({ version: '2' })}
        permitted
        disabledReason={null}
        refetch={refetch}
        onDone={vi.fn()}
        environment={governedEnvironment(
          wire.fetcher,
          new MemoryStorage(),
          vi.fn(),
        )}
      />,
    );
    await click(radio(container, 'approve'));
    await typeInto(reason(container), 'Fine.');
    await click(record(container));
    await flush();
    await typeInto(
      reason(container),
      'Fine. And one more thought typed while saving.',
    );
    wire.settle(decided());
    await flushUntil(() => refetch.mock.calls.length > 0);
    await flush();
    const after = {
      reason: reason(container).value,
      approve: radio(container, 'approve').checked,
    };
    expect(after).toEqual({
      reason: 'Fine. And one more thought typed while saving.',
      approve: false,
    });
  });
});

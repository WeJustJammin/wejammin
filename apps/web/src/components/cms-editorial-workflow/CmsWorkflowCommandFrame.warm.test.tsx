// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CommandState } from './cms-workflow-command-controller';
import CmsWorkflowCommandFrame from './CmsWorkflowCommandFrame';

/*
 * P2-S11-AC-106: the transport and the refusal classifier are not in a form's static graph; a form
 * that receives focus (a sign of intent, as for the validators) warms them so the first submit
 * rarely waits for a chunk. A cold mount loads neither.
 */
const warm = vi.hoisted(() => vi.fn());
vi.mock('./cms-workflow-answer-machinery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cms-workflow-answer-machinery')>()),
  warmWorkflowAnswerMachinery: warm,
}));

beforeAll(enableReactAct);
afterAll(disableReactAct);

const idle: CommandState<{ id: string }> = {
  phase: 'idle',
  idempotencyKey: 'key-0000000001',
  committed: null,
  refusal: null,
  stepUpIssue: null,
  signInHref: null,
  requestId: null,
  reconciled: false,
  restoredValues: null,
  conflict: null,
};

const controller = () => ({
  retry: vi.fn(() => Promise.resolve()),
  reconcile: vi.fn(() => Promise.resolve()),
  dismiss: vi.fn(),
  acknowledgeConflict: vi.fn(),
});

const mount = () =>
  mountElement(
    <CmsWorkflowCommandFrame
      headingId="form-title"
      title="Record a decision"
      state={idle}
      controller={controller()}
      pendingLabel="Recording decision…"
      committedLabel={(resource: { id: string }) => `Recorded ${resource.id}.`}
      fieldIds={{ reason: { id: 'reason-field', label: 'Reason' } }}
    >
      <input id="reason-field" aria-label="Reason" />
    </CmsWorkflowCommandFrame>,
  );

describe('CmsWorkflowCommandFrame answer-machinery warm-up', () => {
  it('warms the transport and the refusal classifier when a control of the form takes focus, not on mount', async () => {
    const { container } = mount();
    await flush();
    expect(warm).not.toHaveBeenCalled();
    (container.querySelector('#reason-field') as HTMLElement).focus();
    await flush();
    expect(warm).toHaveBeenCalledTimes(1);
  });
});

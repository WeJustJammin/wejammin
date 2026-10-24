// @vitest-environment jsdom
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkflowTextField } from './CmsWorkflowFields';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { HYDRATED_ATTRIBUTE, REGION_ATTRIBUTE } from './cms-lazy-intent';
import type { CommandState } from './cms-workflow-command-controller';
import CmsWorkflowCommandFrame from './CmsWorkflowCommandFrame';

/*
 * A form that loads on intent (`cms-lazy-intent.ts`) names its region on the command frame: the
 * server markup carries the region, and the mounted frame marks it hydrated so a held submit is
 * replayed and the region stops waiting.
 */
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

const frame = (lazyRegion?: string) => (
  <CmsWorkflowCommandFrame
    headingId="form-title"
    title="Submit for review"
    state={idle}
    controller={controller()}
    pendingLabel="Submitting…"
    committedLabel={(resource: { id: string }) => `Done ${resource.id}.`}
    fieldIds={{}}
    {...(lazyRegion === undefined ? {} : { lazyRegion })}
  >
    <WorkflowTextField
      id="reason"
      label="Reason"
      value=""
      onChange={() => undefined}
    />
  </CmsWorkflowCommandFrame>
);

describe('CmsWorkflowCommandFrame lazy region', () => {
  it('makes a frame that does not load on intent a region named by its heading id', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(frame());
    const section = host.querySelector('section[data-cms-workflow-form]');
    expect(section?.getAttribute(REGION_ATTRIBUTE)).toBe(
      section?.getAttribute('aria-labelledby'),
    );
  });

  it('puts the region in the server markup on the form section', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(frame('governed-submit'));
    const section = host.querySelector('section[data-cms-workflow-form]');
    expect(section?.getAttribute(REGION_ATTRIBUTE)).toBe('governed-submit');
    expect(section?.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(false);
  });

  it('marks the region hydrated when the frame mounts', async () => {
    const { container } = mountElement(frame('governed-submit'));
    await flush();
    const section = container.querySelector('section[data-cms-workflow-form]');
    expect(section?.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(true);
  });

  it('marks a frame without a named region hydrated too, so a press before it arrived is replayed', async () => {
    const { container } = mountElement(frame());
    await flush();
    expect(container.querySelector(`[${HYDRATED_ATTRIBUTE}]`)).not.toBeNull();
  });
});

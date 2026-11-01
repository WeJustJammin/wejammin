// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  HASH_A,
  SUBJECT_ID,
  governedApiError,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import {
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
afterAll(disableReactAct);

/*
 * The submit form of the panel is a module of its own (`CmsGovernedSubmitForm.tsx`, loaded when
 * the subject is a draft). What it shows around the command is part of the panel's contract.
 */
const subject = (
  overrides: Partial<GovernedPanelSubject> = {},
): GovernedPanelSubject => ({
  kind: 'template_version',
  id: SUBJECT_ID,
  hash: HASH_A,
  key: 'profile-header',
  version: 2,
  state: 'draft',
  ...overrides,
});

const submit = (container: HTMLElement) =>
  buttonNamed(container, 'Submit for review');

describe('the panel submit form', () => {
  it('titles its frame with the id the page focuses and marks the button busy only while the command is in flight', async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    const { container } = mountElement(
      <CmsGovernedReviewPanel
        subject={subject()}
        readSubject={async () => subject({ state: 'review' })}
        environment={governedEnvironment(fetcher)}
      />,
    );
    expect(
      container.querySelector('#governed-panel-form-title')?.textContent,
    ).toBe('Submit for review');
    expect(submit(container).getAttribute('aria-busy')).toBe('false');
    await click(submit(container));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(submit(container).getAttribute('aria-busy')).toBe('true');
  });

  it('says the state cannot be verified beside a version that is no longer a draft, once a read after an unknown outcome fails', async () => {
    const reads = [subject({ state: 'review' }), null];
    const fetcher = queuedFetcher([
      jsonResponse(503, governedApiError('DEPENDENCY_UNAVAILABLE', 'x', {})),
      jsonResponse(503, governedApiError('DEPENDENCY_UNAVAILABLE', 'x', {})),
    ]);
    const { container } = mountElement(
      <CmsGovernedReviewPanel
        subject={subject()}
        readSubject={async () => reads.shift() ?? null}
        environment={governedEnvironment(fetcher)}
      />,
    );
    await click(submit(container));
    await flush();
    expect(container.textContent).toContain('Lifecycle: In review');
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    const own = [
      ...container.querySelectorAll(
        'section[aria-labelledby="governed-panel-title"] > p',
      ),
    ].map((paragraph) => paragraph.textContent);
    expect(own).toContain(
      'The current state could not be verified. Submitting is off until it is.',
    );
  });
});

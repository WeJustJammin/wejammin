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

const subject: GovernedPanelSubject = {
  kind: 'template_version',
  id: SUBJECT_ID,
  hash: HASH_A,
  key: 'profile-header',
  version: 2,
  state: 'draft',
};

const submitWith = async (response: Response) => {
  const readSubject = vi.fn(async () => subject as GovernedPanelSubject | null);
  const { container } = mountElement(
    <CmsGovernedReviewPanel
      subject={subject}
      readSubject={readSubject}
      environment={governedEnvironment(queuedFetcher([response]))}
    />,
  );
  await click(buttonNamed(container, 'Submit for review'));
  await flush();
  return container;
};

/** [P2-S12-AC-069] "the 403/404 split": a hidden or absent subject at submit time is the concealed not-found line, never the capability gate. */
describe('CmsGovernedReviewPanel: the 404 half of the 403/404 split', () => {
  it('shows the one non-disclosing not-available line for a hidden or absent subject, with no capability gate', async () => {
    const container = await submitWith(
      jsonResponse(
        404,
        governedApiError('GOVERNED_REVIEW_NOT_FOUND', 'A fixed message.', {}),
      ),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'This record is not available.',
    );
    expect(
      container.querySelector('[data-cms-editorial-capability-gate]'),
    ).toBeNull();
    expect(container.querySelector('a[href*="step-up"]')).toBeNull();
    expect(container.querySelector('#governed-panel-result')).toBeNull();
  });

  it('keeps the two halves distinct: the 403 shows the capability gate and no not-available line', async () => {
    const container = await submitWith(
      jsonResponse(
        403,
        governedApiError('GOVERNED_REVIEW_FORBIDDEN', 'A fixed message.', {
          reasonCode: 'capability_missing',
        }),
      ),
    );
    expect(
      container.querySelector('[data-cms-editorial-capability-gate]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain(
      'This record is not available.',
    );
  });
});

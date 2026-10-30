// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  byLabel,
  choose,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import {
  created,
  create,
  ends,
  mount,
  why,
} from './CmsGovernedAssignmentForm.states.test-support';
import { heldWire } from './governed-command-states.test-support';
import { flushUntil } from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

/** The late-edit rule (FE03 1046) for the CMS-03C-08 create form: what was sent is cleared, a later edit is kept. */
describe('CmsGovernedAssignmentForm (CMS-03C-08 create and revoke) commandState', () => {
  it('[P2-S12-AC-271] commandState success: a reason typed and a reviewer cleared after dispatch are kept as edited, the sent values are cleared', async () => {
    const wire = heldWire();
    const assigning = mount(wire.fetcher);
    await create(assigning.container);
    await flush();
    await typeInto(why(assigning.container), 'Typed while sending.');
    await choose(
      byLabel<HTMLSelectElement>(assigning.container, 'Reviewer'),
      '',
    );
    wire.settle(created());
    await flushUntil(() => assigning.refetch.mock.calls.length > 0);
    await flush();
    expect(why(assigning.container).value).toBe('Typed while sending.');
    expect(ends(assigning.container).value).toBe('');
    expect(
      byLabel<HTMLSelectElement>(assigning.container, 'Reviewer').value,
    ).toBe('');
  });
});

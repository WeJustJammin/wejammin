// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  KEY,
  governedActivationFixture,
  governedRetiredFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  accepted,
  activeReview,
  approvedReview,
  choosing,
  continueButton,
  mountActivation,
  radio,
  statusLine,
} from './governed-activation-form.test-support';
import CmsGovernedActivationForm from './CmsGovernedActivationForm';
import {
  bodyOf,
  governedEnvironment,
  headersOf,
  pathOf,
} from './governed-review-form-test-support';

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const confirm = (container: HTMLElement, name: string) =>
  buttonNamed(container, name);

describe('CmsGovernedActivationForm (CMS-03C-09) controls', () => {
  it('offers exactly the permitted actions as unselected radios under a named heading', () => {
    const { container } = mountActivation([]);
    expect(container.querySelector('h3')?.textContent).toBe(
      'Activate or schedule this version',
    );
    const labels = Array.from(
      container.querySelectorAll('input[type="radio"]'),
    ).map((input) => input.closest('label')?.textContent?.trim());
    expect(labels).toEqual(['Activate now', 'Schedule activation']);
    expect(
      Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ).some((input) => input.checked),
    ).toBe(false);
  });

  it('offers only Retire for an active version', () => {
    const { container } = mountActivation([], { review: activeReview() });
    expect(container.querySelector('h3')?.textContent).toBe(
      'Retire this version',
    );
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(1);
    expect(radio(container, 'Retire this version')).toBeTruthy();
  });

  it('renders nothing while the server permits no activation action', () => {
    const { container } = mountActivation([], {
      review: approvedReview({ permittedNextActions: ['record_decision'] }),
    });
    expect(container.textContent).toBe('');
  });

  it('names the consequence of the chosen action beside the choice', async () => {
    const { container } = mountActivation([]);
    await choosing(container, 'Activate now');
    expect(container.textContent).toContain(
      'This version becomes the active one and any version that is active now is superseded. Activation is not publication.',
    );
    await choosing(container, 'Schedule activation');
    expect(container.textContent).toContain(
      'This version is not active until the time you choose. Nothing changes before then.',
    );
  });

  it('refuses a missing choice inline, sending nothing, with focus on the summary', async () => {
    const { container, fetcher } = mountActivation([]);
    await click(continueButton(container));
    const alert = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('Choose activate or schedule.');
    expect(document.activeElement).toBe(alert);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('activation confirmation step', () => {
  it('asks for a second explicit click that names the consequence and sends nothing before it', async () => {
    const { container, fetcher } = mountActivation([]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    const heading = container.querySelector(
      '#governed-activation-confirm-title',
    );
    expect(heading?.textContent).toBe('Confirm activation');
    expect(document.activeElement).toBe(heading);
    expect(container.textContent).toContain(
      'Activate Template profile-header, version 2 now.',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('cancels with the Cancel button, with Escape and by changing the choice, never sending', async () => {
    const { container, fetcher } = mountActivation([]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(confirm(container, 'Cancel'));
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
    await click(continueButton(container));
    const heading = container.querySelector(
      '#governed-activation-confirm-title',
    ) as HTMLElement;
    const { act } = await import('react');
    await act(async () => {
      heading.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
    await click(continueButton(container));
    await choosing(container, 'Schedule activation');
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not send when Enter submits a field: that only moves to the confirmation', async () => {
    const { container, fetcher } = mountActivation([], {
      review: activeReview(),
    });
    await choosing(container, 'Retire this version');
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, /^Reason/u),
      'Done.',
    );
    await click(continueButton(container));
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('the confirmation belongs to what it was made for', () => {
  it('is withdrawn when the review version moves under it', async () => {
    const { container, rerender, fetcher } = mountActivation([]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).not.toBeNull();
    rerender(
      <CmsGovernedActivationForm
        review={approvedReview({ version: '3' })}
        disabledReason={null}
        refetch={async () => true}
        onDone={vi.fn()}
        environment={governedEnvironment(fetcher)}
      />,
    );
    await flush();
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('leaves the committed state when the person begins again with Continue', async () => {
    const { container } = mountActivation([
      accepted(200, governedActivationFixture(), '"3"'),
    ]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(confirm(container, 'Activate this version'));
    await flush();
    expect(statusLine(container)).toContain('Activated, not published');
    await click(continueButton(container));
    expect(statusLine(container)).toBe('');
    expect(radio(container, 'Activate now').checked).toBe(false);
  });
});

describe('activation commit', () => {
  it('sends the strict body at the review version, refetches, focuses the summary and announces "not published"', async () => {
    const { container, fetcher, refetch, onDone } = mountActivation([
      accepted(200, governedActivationFixture(), '"3"'),
    ]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(confirm(container, 'Activate this version'));
    await flush();
    expect(pathOf(fetcher)).toMatch(/\/activation$/u);
    expect(bodyOf(fetcher)).toEqual({
      action: 'activate',
      expectedVersion: '2',
    });
    expect(headersOf(fetcher).get('if-match')).toBe('"2"');
    expect(headersOf(fetcher).get('idempotency-key')).toBe(KEY);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('governed-summary-title');
    expect(statusLine(container)).toBe(
      'Activated, not published: Template profile-header, version 2 is now the active version. Version 1 is now superseded.',
    );
  });

  it('says only that the version is active when the lineage had nothing active to supersede (DEC-191)', async () => {
    const { container } = mountActivation([
      accepted(
        200,
        governedActivationFixture({ supersededVersion: null }),
        '"3"',
      ),
    ]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(confirm(container, 'Activate this version'));
    await flush();
    expect(statusLine(container)).toBe(
      'Activated, not published: Template profile-header, version 2 is now the active version.',
    );
  });

  it('names the version the answer says was superseded, not a guess (DEC-191)', async () => {
    const { container } = mountActivation([
      accepted(
        200,
        governedActivationFixture({ subjectVersion: 5, supersededVersion: 4 }),
        '"3"',
      ),
    ]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(confirm(container, 'Activate this version'));
    await flush();
    expect(statusLine(container)).toBe(
      'Activated, not published: Template profile-header, version 5 is now the active version. Version 4 is now superseded.',
    );
  });

  it('can start the next command after a commit, at the advanced review version', async () => {
    const { container, fetcher, rerender } = mountActivation([
      accepted(200, governedActivationFixture(), '"3"'),
      accepted(200, governedRetiredFixture({ reviewVersion: '4' }), '"4"'),
    ]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(confirm(container, 'Activate this version'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender(
      <CmsGovernedActivationForm
        review={activeReview({ version: '3' })}
        disabledReason={null}
        refetch={async () => true}
        onDone={vi.fn()}
        environment={governedEnvironment(fetcher)}
      />,
    );
    await flush();
    expect(radio(container, 'Retire this version').checked).toBe(false);
    await choosing(container, 'Retire this version');
    await click(continueButton(container));
    await click(confirm(container, 'Retire this version'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetcher, 1)).toEqual({
      action: 'retire',
      expectedVersion: '3',
    });
    expect(headersOf(fetcher, 1).get('if-match')).toBe('"3"');
  });
});

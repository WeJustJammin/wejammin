// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  press,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { governedActivationFixture } from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedActivationForm from './CmsGovernedActivationForm';
import {
  accepted,
  apiFailure,
  approvedReview,
  choosing,
  continueButton,
  mountActivation,
} from './governed-activation-form.test-support';
import { governedEnvironment } from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const CONFIRM = '#governed-activation-confirm-title';

/** A wire that holds the command in flight until the test settles it. */
const heldWire = () => {
  let settle: (response: Response) => void = () => undefined;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        settle = resolve;
      }),
  );
  return { fetcher, settle: (response: Response) => settle(response) };
};

const pending = async (extra: Parameters<typeof mountActivation>[1] = {}) => {
  const wire = heldWire();
  const mounted = mountActivation([], {
    environment: governedEnvironment(wire.fetcher),
    ...extra,
  });
  const { container } = mounted;
  await choosing(container, 'Activate now');
  await click(continueButton(container));
  const commit = buttonNamed(container, 'Activate this version');
  commit.focus();
  await click(commit);
  await flush();
  return { ...mounted, ...wire, commit };
};

describe('the confirmation while the command is in flight (FE03 :1118, :1216)', () => {
  it('stays mounted with focus on the same commit control, aria-disabled, busy, label kept, pending text exposed', async () => {
    const { container, commit, fetcher } = await pending();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.querySelector(CONFIRM)).not.toBeNull();
    expect(buttonNamed(container, 'Activate this version')).toBe(commit);
    expect(commit.getAttribute('aria-disabled')).toBe('true');
    expect(commit.getAttribute('aria-busy')).toBe('true');
    expect(buttonNamed(container, 'Cancel').getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(document.activeElement).toBe(commit);
    const described = commit.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent).toBe('Activating…');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('Activating…');
  });

  it('sends nothing more and withdraws nothing on a second click, Cancel or Escape', async () => {
    const { container, commit, fetcher } = await pending();
    await click(commit);
    await click(buttonNamed(container, 'Cancel'));
    await press(container.querySelector(CONFIRM) as HTMLElement, 'Escape');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.querySelector(CONFIRM)).not.toBeNull();
    expect(document.activeElement).toBe(commit);
  });

  it('clears the confirmation when the answer settles', async () => {
    const { container, settle } = await pending();
    settle(accepted(200, governedActivationFixture(), '"3"'));
    await flush();
    await flush();
    expect(container.querySelector(CONFIRM)).toBeNull();
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toContain('Activated, not published');
  });

  it('clears the confirmation when the answer is a refusal, too', async () => {
    const { container, settle } = await pending();
    settle(
      apiFailure(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
        reasonCode: 'subject_not_activatable',
      }),
    );
    await flush();
    await flush();
    expect(container.querySelector(CONFIRM)).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});

/** A summary heading outside the form, as the island has, and a re-read the test releases. */
const heldReread = () => {
  const heading = document.createElement('h2');
  heading.id = 'summary';
  heading.tabIndex = -1;
  document.body.appendChild(heading);
  let release: () => void = () => undefined;
  const held = new Promise<boolean>((resolve) => {
    release = () => resolve(true);
  });
  const stepWhenDone: boolean[] = [];
  return {
    heading,
    release: () => release(),
    refetch: vi.fn(() => held),
    onDone: vi.fn(() => {
      stepWhenDone.push(document.querySelector(CONFIRM) !== null);
      heading.focus();
    }),
    stepWhenDone,
  };
};

describe('focus until the result is named (FE03 :1118, :1223)', () => {
  it('keeps focus on the commit control through the re-read after a commit, then moves it to the summary heading', async () => {
    const reread = heldReread();
    const { container, settle, commit } = await pending({
      refetch: reread.refetch,
      onDone: reread.onDone,
    });
    settle(accepted(200, governedActivationFixture(), '"3"'));
    await flush();
    await flush();
    expect(reread.refetch).toHaveBeenCalledTimes(1);
    expect(reread.onDone).not.toHaveBeenCalled();
    expect(container.querySelector(CONFIRM)).not.toBeNull();
    expect(document.activeElement).toBe(commit);
    reread.release();
    await flush();
    await flush();
    expect(reread.onDone).toHaveBeenCalledTimes(1);
    expect(reread.stepWhenDone).toEqual([true]);
    expect(document.activeElement).toBe(reread.heading);
    expect(container.querySelector(CONFIRM)).toBeNull();
    reread.heading.remove();
  });

  it('puts focus on "Check the current state" when the outcome is unknown', async () => {
    const { container, settle } = await pending();
    settle(apiFailure(504, 'DEPENDENCY_UNAVAILABLE'));
    await flush();
    await flush();
    expect(container.querySelector(CONFIRM)).toBeNull();
    expect(document.activeElement).toBe(
      buttonNamed(container, 'Check the current state'),
    );
    expect(document.activeElement?.id).toBe('governed-activation-title-check');
  });
});

describe('the pending words follow the submitted action (FE03 :1223)', () => {
  it('still says Activating while the person changes the choice mid-flight', async () => {
    const { container } = await pending();
    await choosing(container, 'Schedule activation');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('Activating…');
  });
});

describe('a confirmation left open when the read stops being verified', () => {
  it('cannot be committed until the read is verified again', async () => {
    const fetcher = vi.fn(async () =>
      accepted(200, governedActivationFixture(), '"3"'),
    );
    const { container, rerender } = mountActivation([], {
      environment: governedEnvironment(fetcher),
    });
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    rerender(
      <CmsGovernedActivationForm
        review={approvedReview()}
        disabledReason="Reload the page."
        refetch={async () => true}
        onDone={vi.fn()}
        environment={governedEnvironment(fetcher)}
      />,
    );
    await flush();
    const commit = buttonNamed(container, 'Activate this version');
    expect(commit.getAttribute('aria-disabled')).toBe('true');
    await click(commit);
    await flush();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

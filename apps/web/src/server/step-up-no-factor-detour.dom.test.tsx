// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startDryRunPreparation } from '../components/content-schema-registry/content-schema-registry-activation-preparation.test-support';
import { installContentSchemaRegistryCommandEnhancement } from '../components/content-schema-registry/content-schema-registry-runtime-dom-mutations';
import {
  dryRunResource,
  draftDetail,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';
import {
  renderDocument,
  requireForm,
  successDetail,
  versionPageProps,
} from '../components/content-schema-registry/content-schema-review-dec108-render.test-support';
import { mfaSettingsHref } from '../components/identity-authority/step-up-mfa/step-up-return';
import { mountWizard } from '../components/identity-authority/step-up-mfa/mfa-wizard-support.test-support';
import { mountForm } from '../components/identity-authority/step-up-mfa/step-up-form-support.test-support';
import {
  FRESH_UNTIL,
  enrollment,
  factor,
  factorsResource as wizardFactors,
  flush,
  json as stubJson,
  FACTOR_B,
  setValue,
  stubFetch,
} from '../components/identity-authority/step-up-mfa/step-up-mfa.test-support';
import {
  fillAndSubmitName,
  pressButton,
} from '../components/identity-authority/step-up-mfa/mfa-wizard-support.test-support';
import { createMemoryLockManager } from '../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../lib/test-support/memory-storage';
import { resolveMfaSettingsPage } from './mfa-settings-page-context';
import { resolveStepUpPage } from './step-up-page-context';
import {
  REQUEST_ID,
  bindingStub,
  factorsResource,
  jsonResponse,
  pageRequest,
} from './step-up-mfa-context.test-support';

/**
 * IA01 edge case (AC1140): a person with no verified factor is interrupted by
 * a command that needs step-up. The chain is composed from the real parts:
 * the real server-rendered command form and enhancement runtime, the real
 * `/step-up` and `/settings/security/mfa` server resolvers over a scripted
 * private binding, and the real islands. Only the network is scripted.
 */

const PATH = '/app/cms-content-modeling/type/versions/version';
const INTERRUPTED = `${PATH}?limit=25`;
const locks = createMemoryLockManager();

const stepUpRequired = (): Response =>
  new Response(
    JSON.stringify({
      code: 'STEP_UP_REQUIRED',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      message: 'Recent verification is required.',
      requestId: REQUEST_ID,
    }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  );

const mountInterruptedForm = (): HTMLFormElement => {
  window.history.replaceState({}, '', INTERRUPTED);
  const page = renderDocument(
    versionPageProps({
      initialDetail: successDetail(draftDetail(startDryRunPreparation)),
    }),
  );
  document.body.innerHTML = page.body.innerHTML;
  const form = requireForm(document, 'CMS-03A-10');
  form.setAttribute('action', PATH);
  return form;
};

const submitAndWait = async (
  form: HTMLFormElement,
  done: () => boolean,
): Promise<void> => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(done()).toBe(true));
};

beforeEach(() => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  locks.releaseAll();
  document.body.replaceChildren();
});

describe('[P2-S09-AC-1140] no verified factor when step-up is needed', () => {
  it('[P2-S09-AC-1140] the interrupted command is refused once, never reports success and is not replayed by the browser', async () => {
    const form = mountInterruptedForm();
    const fetchStub = vi.fn(async () => stepUpRequired());
    vi.stubGlobal('fetch', fetchStub);
    const navigate = vi.fn();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    await submitAndWait(form, () => navigate.mock.calls.length > 0);
    cleanup();
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(form.textContent).not.toMatch(/accepted|passed|queued/iu);
    expect(navigate).toHaveBeenCalledWith(
      `/step-up?returnTo=${encodeURIComponent(INTERRUPTED)}`,
    );
  });

  it('[P2-S09-AC-1140] the /step-up page for a person with no verified factor routes to enrollment and creates no challenge', async () => {
    const binding = bindingStub(
      jsonResponse(200, factorsResource({ factors: [] })),
    );
    const resolved = await resolveStepUpPage({
      request: pageRequest('/step-up'),
      binding,
      returnToParam: INTERRUPTED,
      requestId: REQUEST_ID,
    });
    if (resolved.kind !== 'ready') throw new Error(`got ${resolved.kind}`);
    expect(resolved.page.initialPhase).toBe('no-factor');
    expect(resolved.page.returnTo).toBe(INTERRUPTED);

    const fetchImpl = stubFetch();
    const harness = mountForm(fetchImpl, {
      initialPhase: resolved.page.initialPhase,
      factors: [],
      returnTo: resolved.page.returnTo,
    });
    await flush();
    const container = harness.mounted.container;
    expect(
      container
        .querySelector<HTMLAnchorElement>('a[href^="/settings/security/mfa"]')
        ?.getAttribute('href'),
    ).toBe(mfaSettingsHref(INTERRUPTED));
    expect(container.querySelector('input[name="code"]')).toBeNull();
    expect(fetchImpl.calls).toHaveLength(0);
    harness.mounted.unmount();
  });

  it('[P2-S09-AC-1140] enrollment entered from the step-up page returns to the interrupted page after the factor is verified', async () => {
    const binding = bindingStub(
      jsonResponse(200, factorsResource({ factors: [] })),
    );
    const resolved = await resolveMfaSettingsPage({
      request: pageRequest('/settings/security/mfa'),
      binding,
      returnToParam: INTERRUPTED,
      requestId: REQUEST_ID,
    });
    if (resolved.kind !== 'ready') throw new Error(`got ${resolved.kind}`);
    expect(resolved.page.returnTo).toBe(INTERRUPTED);

    const fetchImpl = stubFetch(
      stubJson(201, enrollment('5'), { etag: '"5"' }),
      stubJson(200, wizardFactors([factor(FACTOR_B)], '6', true), {
        etag: '"6"',
      }),
    );
    const harness = mountWizard(fetchImpl, {
      factors: [],
      returnTo: resolved.page.returnTo,
      expectedVersion: resolved.page.expectedVersion,
    });
    const container = harness.mounted.container;
    pressButton(container, 'Set up an authenticator');
    fillAndSubmitName(container, 'Laptop');
    await flush();
    const input =
      container.querySelector<HTMLInputElement>('input[name="code"]');
    if (input === null) throw new Error('missing code field');
    setValue(input, '123456');
    pressButton(container, 'Verify and finish');
    await flush();
    expect(container.textContent).toContain('Authenticator added');
    expect(
      container.querySelector(`time[datetime="${FRESH_UNTIL}"]`),
    ).not.toBeNull();
    const back = [...container.querySelectorAll('a')].find(
      (anchor) => anchor.textContent === 'Continue',
    );
    expect(back?.getAttribute('href')).toBe(INTERRUPTED);
    harness.mounted.unmount();
  });

  it('[P2-S09-AC-1140] on return the interrupted form is restored for confirmation and nothing is submitted until the person confirms with a proof', async () => {
    const first = mountInterruptedForm();
    const refused = vi.fn(async () => stepUpRequired());
    vi.stubGlobal('fetch', refused);
    const navigate = vi.fn();
    const cleanupFirst = installContentSchemaRegistryCommandEnhancement(
      document,
      { navigate },
    );
    await submitAndWait(first, () => navigate.mock.calls.length > 0);
    cleanupFirst();

    // The person verified; the browser lands on the interrupted page again.
    document.body.replaceChildren();
    const returned = mountInterruptedForm();
    const accepted = vi.fn(
      async () =>
        new Response(JSON.stringify(dryRunResource()), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', accepted);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    expect(
      returned.querySelector('[data-cms-command-status]')?.textContent,
    ).toBe('Verification complete. Review and confirm to continue.');
    expect(accepted).not.toHaveBeenCalled();
    expect(refused).toHaveBeenCalledTimes(1);

    await submitAndWait(returned, () => accepted.mock.calls.length > 0);
    expect(accepted).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StepUpPageHeading from '../components/identity-authority/step-up-mfa/StepUpPageHeading';
import {
  STEP_UP_PAGE_HEADINGS,
  type StepUpPageKey,
} from '../components/identity-authority/step-up-mfa/step-up-page-headings';
import { mountForm } from '../components/identity-authority/step-up-mfa/step-up-form-support.test-support';
import { mountWizard } from '../components/identity-authority/step-up-mfa/mfa-wizard-support.test-support';
import { authPageRedirect } from './auth-page-redirect';
import { resolveMfaSettingsPage } from './mfa-settings-page-context';
import { resolveStepUpPage } from './step-up-page-context';
import {
  REQUEST_ID,
  bindingStub,
  errorResponse,
  factorsResource,
  jsonResponse,
  pageRequest,
} from './step-up-mfa-context.test-support';

/**
 * FE01 `/step-up` and `/settings/security/mfa` pages. The sign-in redirect is
 * the real response object the Astro pages return, built from the real server
 * resolvers over a scripted PLATFORM_API binding; the heading is the real
 * component the pages render, focused by the real route script.
 */

const STEP_UP_PREFIX = '/step-up?returnTo=';
const SIGN_IN_PREFIX = '/auth/sign-in?returnTo=';

const stepUpRedirect = async (
  upstream: Response,
  returnToParam: string | null,
  request: Request = pageRequest('/step-up'),
): Promise<{ response: Response; sent: Request[] }> => {
  const binding = bindingStub(upstream);
  const resolved = await resolveStepUpPage({
    request,
    binding,
    returnToParam,
    requestId: REQUEST_ID,
  });
  if (resolved.kind !== 'unauthenticated')
    throw new Error(`expected unauthenticated, got ${resolved.kind}`);
  return {
    response: authPageRedirect(resolved.location),
    sent: binding.requests(),
  };
};

const signInLocation = (nestedReturnTo: string): string =>
  `${SIGN_IN_PREFIX}${encodeURIComponent(nestedReturnTo)}`;
const nestedStepUp = (returnTo: string): string =>
  `${STEP_UP_PREFIX}${encodeURIComponent(returnTo)}`;

describe('/step-up unauthenticated redirect', () => {
  it('[P2-S09-AC-1067] a missing session (no cookie) is a 303 to sign-in carrying the encoded /step-up?returnTo=, never cached, with no body', async () => {
    // Control: a live session renders the page instead of redirecting.
    const live = await resolveStepUpPage({
      request: pageRequest('/step-up'),
      binding: bindingStub(jsonResponse(200, factorsResource())),
      returnToParam: '/app/cms-content-modeling?x=1',
      requestId: REQUEST_ID,
    });
    expect(live.kind).toBe('ready');
    const { response, sent } = await stepUpRedirect(
      errorResponse(401, 'UNAUTHENTICATED'),
      '/app/cms-content-modeling?x=1',
      new Request('https://app.example.test/step-up'),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.headers.get('cookie')).toBeNull();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      signInLocation(nestedStepUp('/app/cms-content-modeling?x=1')),
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.body).toBeNull();
  });

  it('[P2-S09-AC-1067] an expired session (cookie present, platform 401) is the same 303', async () => {
    const { response, sent } = await stepUpRedirect(
      errorResponse(401, 'UNAUTHENTICATED'),
      '/app/cms-content-modeling?x=1',
    );
    expect(sent[0]?.headers.get('cookie')).toContain('wj_access=a');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      signInLocation(nestedStepUp('/app/cms-content-modeling?x=1')),
    );
  });

  it.each([
    ['a scheme', 'https://evil.example/app'],
    ['an authority', '//evil.example/app'],
    ['a backslash', '/app\\evil'],
    ['a control character', '/app\u0007x'],
    ['a percent-encoded slash', '/app%2fevil'],
    ['the step-up page itself', '/step-up?returnTo=%2Fapp'],
    ['an auth path', '/auth/sign-in'],
    ['over 512 characters', `/app/${'a'.repeat(508)}`],
    ['no value', null],
  ])(
    '[P2-S09-AC-1067] %s in returnTo is replaced by /app inside the sign-in return target',
    async (_name, returnTo) => {
      const { response } = await stepUpRedirect(
        errorResponse(401, 'UNAUTHENTICATED'),
        returnTo,
      );
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        signInLocation(nestedStepUp('/app')),
      );
    },
  );

  it('[P2-S09-AC-1067] a combined /step-up?returnTo= value of exactly 512 characters is carried whole', async () => {
    const returnTo = `/app/${'a'.repeat(485)}`;
    expect(nestedStepUp(returnTo)).toHaveLength(512);
    const { response } = await stepUpRedirect(
      errorResponse(401, 'UNAUTHENTICATED'),
      returnTo,
    );
    expect(response.headers.get('location')).toBe(
      signInLocation(nestedStepUp(returnTo)),
    );
  });

  it('[P2-S09-AC-1067] a combined value of 513 characters is replaced by /step-up alone', async () => {
    const returnTo = `/app/${'a'.repeat(486)}`;
    expect(nestedStepUp(returnTo)).toHaveLength(513);
    const { response } = await stepUpRedirect(
      errorResponse(401, 'UNAUTHENTICATED'),
      returnTo,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(signInLocation('/step-up'));
  });
});

describe('/settings/security/mfa unauthenticated redirect', () => {
  it('[P2-S09-AC-1070] a missing or expired session is a 303 to sign-in returning to the enrollment page, never cached', async () => {
    const resolved = await resolveMfaSettingsPage({
      request: pageRequest('/settings/security/mfa'),
      binding: bindingStub(errorResponse(401, 'UNAUTHENTICATED')),
      returnToParam: null,
      requestId: REQUEST_ID,
    });
    if (resolved.kind !== 'unauthenticated')
      throw new Error(`expected unauthenticated, got ${resolved.kind}`);
    const response = authPageRedirect(resolved.location);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/auth/sign-in?returnTo=%2Fsettings%2Fsecurity%2Fmfa',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

const PAGES: readonly [StepUpPageKey, string][] = [
  ['step-up', "Verify it's you"],
  ['mfa', 'Two-step verification'],
];

const headingDocument = (page: StepUpPageKey): Document =>
  new DOMParser().parseFromString(
    `<body><main id="main-content" tabindex="-1">${renderToStaticMarkup(
      React.createElement(StepUpPageHeading, { page }),
    )}</main></body>`,
    'text/html',
  );

afterEach(() => {
  vi.resetModules();
  window.location.hash = '';
  document.body.innerHTML = '';
});

describe('auth page heading, title and route focus', () => {
  it.each(PAGES)(
    '[P2-S09-AC-1101] the %s page renders exactly one h1 with the exact text and a tabindex of -1',
    (page, text) => {
      const doc = headingDocument(page);
      const headings = [...doc.querySelectorAll('h1')];
      expect(headings).toHaveLength(1);
      expect(headings[0]?.textContent).toBe(text);
      expect(headings[0]?.id).toBe('page-title');
      expect(headings[0]?.getAttribute('tabindex')).toBe('-1');
    },
  );

  it.each(PAGES)(
    '[P2-S09-AC-1101] the %s document title names the page purpose and the product',
    (page, text) => {
      expect(STEP_UP_PAGE_HEADINGS[page].documentTitle).toBe(
        `${text} | WeJammin`,
      );
    },
  );

  it.each(PAGES)(
    '[P2-S09-AC-1101] on route load the real focus script moves focus to the %s h1',
    async (page) => {
      document.body.innerHTML = headingDocument(page).body.innerHTML;
      expect(document.activeElement).toBe(document.body);
      await import('../components/identity-authority/step-up-mfa/focus-page-heading');
      expect(document.activeElement?.id).toBe('page-title');
      expect(document.activeElement?.tagName).toBe('H1');
    },
  );

  it('[P2-S09-AC-1101] the hydrated islands add no second h1 to either page', () => {
    const form = mountForm(vi.fn() as unknown as typeof fetch, {
      initialPhase: 'no-factor',
    });
    expect(form.mounted.container.querySelectorAll('h1')).toHaveLength(0);
    form.mounted.unmount();
    const wizard = mountWizard(vi.fn() as unknown as typeof fetch);
    expect(wizard.mounted.container.querySelectorAll('h1')).toHaveLength(0);
    wizard.mounted.unmount();
  });

  it('[P2-S09-AC-1101] the route script never steals focus from an element that already holds it', async () => {
    document.body.innerHTML = `${headingDocument('step-up').body.innerHTML}<input id="held">`;
    document.getElementById('held')?.focus();
    await import('../components/identity-authority/step-up-mfa/focus-page-heading');
    expect(document.activeElement?.id).toBe('held');
  });
});

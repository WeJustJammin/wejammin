// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { challenge, flush, json, stubFetch } from './step-up-mfa.test-support';
import {
  RETURN_TO,
  mountForm,
  type FormHarness,
} from './step-up-form-support.test-support';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';

import SignInEmailForm from '../../authentication/sign-in/SignInEmailForm';
import { signInEntryFrom } from '../../authentication/sign-in/sign-in-entry';
import { recoverySignInHref, stepUpSignInHref } from './step-up-return';

let harness: FormHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const LOST_ACCESS = 'Lost your authenticator? Recover your account';

const lostAccessLink = (container: HTMLElement): HTMLAnchorElement | null =>
  [...container.querySelectorAll<HTMLAnchorElement>('a')].find(
    (anchor) => anchor.textContent === LOST_ACCESS,
  ) ?? null;

describe('[P2-S09-AC-1098] FE01 lost-access link', () => {
  it('[P2-S09-AC-1098] offers the lost-access link once a code is awaited and sends it to the sign-in recovery entry (intent=recovery), distinct from the expired-session redirect', async () => {
    harness = mountForm(stubFetch(json(201, challenge())));
    await flush();
    const link = lostAccessLink(harness.mounted.container);
    expect(link).not.toBeNull();
    const href = link?.getAttribute('href') ?? '';
    expect(href).toBe(recoverySignInHref(RETURN_TO));
    const target = new URL(href, 'https://app.example.test');
    expect(target.pathname).toBe('/auth/sign-in');
    expect(target.searchParams.get('intent')).toBe('recovery');
    // Not the plain sign-in redirect an expired session uses.
    expect(href).not.toBe(stepUpSignInHref(RETURN_TO));
    expect(stepUpSignInHref(RETURN_TO)).not.toContain('intent=');
  });

  it('[P2-S09-AC-1098] the link carries nothing but the recovery intent and the safe return target, so it is never a bypass', async () => {
    harness = mountForm(stubFetch(json(201, challenge())));
    await flush();
    const href =
      lostAccessLink(harness.mounted.container)?.getAttribute('href') ?? '';
    const target = new URL(href, 'https://app.example.test');
    expect([...target.searchParams.keys()].sort()).toStrictEqual([
      'intent',
      'returnTo',
    ]);
    // The return target is the step-up page, so the proof is asked again after sign-in.
    expect(target.searchParams.get('returnTo')).toBe(
      `/step-up?returnTo=${encodeURIComponent(RETURN_TO)}`,
    );
    expect(href).not.toContain('settings');
    expect(href).not.toMatch(/proof|fresh|bypass|skip|token/iu);
  });

  it('[P2-S09-AC-1098] following the link opens the recovery entry: only the recovery intent is offered, never the ordinary sign-in', async () => {
    harness = mountForm(stubFetch(json(201, challenge())));
    await flush();
    const href =
      lostAccessLink(harness.mounted.container)?.getAttribute('href') ?? '';
    const entry = signInEntryFrom(
      new URL(href, 'https://app.example.test').searchParams.get('intent'),
    );
    expect(entry).toBe('recovery');
    const form = (value: 'sign_in' | 'recovery'): Document =>
      new DOMParser().parseFromString(
        `<body>${renderToStaticMarkup(
          React.createElement(SignInEmailForm, {
            returnTo: '/app',
            entry: value,
          }),
        )}</body>`,
        'text/html',
      );
    const intents = (doc: Document): string[] =>
      [...doc.querySelectorAll<HTMLButtonElement>('button[name="intent"]')].map(
        (button) => button.value,
      );
    expect(form(entry).querySelector('form')?.getAttribute('action')).toBe(
      '/auth/start',
    );
    expect(intents(form(entry))).toStrictEqual(['recovery']);
    // Control: the ordinary entry offers both intents.
    expect(intents(form('sign_in'))).toStrictEqual(['sign_in', 'recovery']);
    for (const other of ['Recovery', 'RECOVERY', 'sign_in', '', 'bypass', null])
      expect(signInEntryFrom(other)).toBe('sign_in');
  });

  it('[P2-S09-AC-1098] also offers it when no verified authenticator exists', async () => {
    harness = mountForm(stubFetch(), { initialPhase: 'no-factor' });
    await flush();
    expect(lostAccessLink(harness.mounted.container)).not.toBeNull();
  });

  it('renders the lost-access link exactly once', async () => {
    harness = mountForm(stubFetch(), { initialPhase: 'no-factor' });
    await flush();
    const links = [...harness.mounted.container.querySelectorAll('a')].filter(
      (anchor) => anchor.textContent === LOST_ACCESS,
    );
    expect(links).toHaveLength(1);
  });
});

// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsReviewerChoice from './CmsReviewerChoice';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';

/*
 * The reviewer list of an assignment form is read on the first intent in the form, so a person's
 * first act (open the list) can land while the read is in flight. The list must say so: one
 * disabled option naming what is happening, `aria-busy` on the control, a polite status, and a
 * failure state with a retry (FE03 "Loading": a read over 250 ms exposes loading; :1125 a
 * picker whose options are missing or degraded says so and offers the retry; :1172 a 429 names its
 * wait). The control itself stays enabled, so opening it is itself a sign of intent.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const OPTIONS: ReviewerOptionsResult = {
  kind: 'ok',
  options: [
    { personId: '30000000-0000-4000-8000-000000000001', endsAt: '2027-01-01' },
  ],
};

const mount = (reviewers: ReviewerOptionsResult | null, retry = vi.fn()) =>
  mountElement(
    <CmsReviewerChoice
      id="reviewer"
      label="Reviewer"
      value=""
      reviewers={reviewers}
      retry={retry}
      error={null}
      invalid={false}
      onChange={() => undefined}
    />,
  );

const select = (container: HTMLElement): HTMLSelectElement =>
  container.querySelector('select') as HTMLSelectElement;
const labels = (container: HTMLElement): string[] =>
  [...select(container).options].map((option) => option.textContent ?? '');

describe('CmsReviewerChoice', () => {
  it('while the read is in flight: one disabled option, aria-busy, an enabled control, a polite status', () => {
    const { container } = mount(null);
    expect(labels(container)).toEqual(['Loading reviewers…']);
    expect(select(container).options[0]?.disabled).toBe(true);
    expect(select(container).getAttribute('aria-busy')).toBe('true');
    expect(select(container).disabled).toBe(false);
    const status = container.querySelector('[data-cms-reviewers-status]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toBe('Loading reviewers…');
  });

  it('when the choices arrive: they replace it, the control is no longer busy, the status says so', () => {
    const { container } = mount(OPTIONS);
    expect(labels(container)).toEqual([
      'Choose a reviewer',
      '30000000-0000-4000-8000-000000000001 (access ends 2027-01-01)',
    ]);
    expect(select(container).getAttribute('aria-busy')).not.toBe('true');
    expect(
      container.querySelector('[data-cms-reviewers-status]')?.textContent,
    ).toBe('Reviewer choices loaded.');
  });

  it('with no grant: says so and links to the grant console', () => {
    const { container } = mount({ kind: 'ok', options: [] });
    expect(container.textContent).toContain(
      'No reviewer has an active cms.reviewer grant.',
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/app/cms-content-modeling/capability-grants',
    );
  });

  it('when the read failed: one disabled option, an alert-free sentence and a retry that asks again', async () => {
    const retry = vi.fn();
    const { container } = mount({ kind: 'unavailable' }, retry);
    expect(labels(container)).toEqual(['Reviewer choices could not be loaded']);
    expect(select(container).options[0]?.disabled).toBe(true);
    expect(container.textContent).not.toContain('Reload the page');
    await click(buttonNamed(container, 'Try loading reviewers again'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('when rate limited: the wait is announced, the list says it is not loaded yet, and there is no manual retry (the read repeats itself)', () => {
    const { container } = mount({
      kind: 'unavailable',
      rateLimit: { retryAfterSeconds: 6 },
    });
    expect(labels(container)).toEqual([
      'Reviewer choices could not be loaded yet',
    ]);
    expect(
      container.querySelector('[data-cms-reviewers-rate-limit]')?.textContent,
    ).toContain('Reviewer choices could not be loaded yet.');
    expect(container.querySelector('button')).toBeNull();
  });
});

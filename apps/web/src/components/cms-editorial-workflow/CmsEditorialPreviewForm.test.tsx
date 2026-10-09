// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { CSRF } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialPreviewForm from './CmsEditorialPreviewForm';
import {
  ENTRY_ID,
  REVISION_ID,
  TOKEN,
  apiError,
  jsonResponse,
  previewResourceFixture,
  versionSetFixture,
} from './cms-workflow-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const KEY = 'idem-key-preview-001';

const minted = (overrides: Record<string, unknown> = {}) =>
  jsonResponse(201, previewResourceFixture(overrides), {});

const mount = (
  responses: readonly Response[],
  extra: Partial<React.ComponentProps<typeof CmsEditorialPreviewForm>> = {},
) => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const copy = vi.fn(async () => undefined);
  const mounted = mountElement(
    <CmsEditorialPreviewForm
      entryId={ENTRY_ID}
      entryVersion="7"
      revisionId={REVISION_ID}
      locale="en-US"
      versionSet={versionSetFixture as never}
      disabledReason={null}
      refetch={refetch}
      copyText={copy}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => null,
        navigate: () => undefined,
      }}
      {...extra}
    />,
  );
  return { ...mounted, fetcher, refetch, copy };
};

const fill = async (
  container: HTMLElement,
  audience = 'members',
  route = '/music/artist/spring-2026-tour',
) => {
  await typeInto(byLabel<HTMLInputElement>(container, 'Audience'), audience);
  await typeInto(byLabel<HTMLInputElement>(container, 'Route'), route);
};

describe('CmsEditorialPreviewForm (CMS-03B-08)', () => {
  it('states the locale it is bound to and asks only for an audience and a route', () => {
    const { container } = mount([]);
    expect(container.querySelector('h3')?.textContent).toBe('Create a preview');
    expect(container.textContent).toContain('Locale: en-US');
    expect(container.querySelectorAll('input')).toHaveLength(2);
    expect(buttonNamed(container, 'Create preview')).toBeDefined();
  });

  it('refuses an invalid audience or route inline, sending nothing', async () => {
    const { container, fetcher } = mount([minted()]);
    await click(buttonNamed(container, 'Create preview'));
    let alert =
      container.querySelector('[data-cms-workflow-local-errors]')
        ?.textContent ?? '';
    expect(alert).toContain('Enter an audience.');
    expect(alert).toContain('Enter a route.');
    await fill(container, 'Not Valid', 'https://evil.example/x');
    await click(buttonNamed(container, 'Create preview'));
    alert =
      container.querySelector('[data-cms-workflow-local-errors]')
        ?.textContent ?? '';
    expect(alert).toContain(
      'Use lowercase letters, digits, hyphens and underscores, up to 48 characters.',
    );
    expect(alert).toContain('Enter a site path that starts with one /');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('echoes the served version set unmodified at the entry version', async () => {
    const { container, fetcher } = mount([minted()]);
    await fill(container);
    await click(buttonNamed(container, 'Create preview'));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe('/api/v1/cms/previews');
    expect(JSON.parse(init.body as string)).toEqual({
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      locale: 'en-US',
      audience: 'members',
      route: '/music/artist/spring-2026-tour',
      versionSet: JSON.parse(JSON.stringify(versionSetFixture)),
    });
    const headers = new Headers(init.headers);
    expect(headers.get('if-match')).toBe('"7"');
    expect(headers.get('idempotency-key')).toBe(KEY);
  });

  it('discloses the token once with its binding and expiry as text and takes focus', async () => {
    const { container } = mount([minted({ revoked: false })]);
    await fill(container);
    await click(buttonNamed(container, 'Create preview'));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-cms-preview-token]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-cms-preview-token]')?.textContent,
    ).toBe(TOKEN);
    const region = container.querySelector(
      '[data-cms-preview-disclosure]',
    ) as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-labelledby')).toBe('preview-token-title');
    expect(region.textContent).toContain('shown once');
    expect(region.textContent).toContain('members');
    expect(region.textContent).toContain('en-US');
    expect(region.textContent).toContain('/music/artist/spring-2026-tour');
    expect(region.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-08T12:15:00Z',
    );
    expect(document.activeElement?.id).toBe('preview-token-title');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).not.toContain(TOKEN);
  });

  it('keeps the token out of the URL, the document title and every storage area', async () => {
    const { container } = mount([minted()]);
    await fill(container);
    await click(buttonNamed(container, 'Create preview'));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-cms-preview-token]'),
      ).not.toBeNull(),
    );
    expect(window.location.href).not.toContain(TOKEN);
    expect(document.title).not.toContain(TOKEN);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(TOKEN);
    expect(container.querySelectorAll('a[href*="' + TOKEN + '"]')).toHaveLength(
      0,
    );
  });

  it('copies the token on request and says so, or says how to copy by hand', async () => {
    const { container, copy, unmount } = mount([minted()]);
    await fill(container);
    await click(buttonNamed(container, 'Create preview'));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-cms-preview-token]'),
      ).not.toBeNull(),
    );
    await click(buttonNamed(container, 'Copy token'));
    expect(copy).toHaveBeenCalledWith(TOKEN);
    expect(
      container.querySelector('[data-cms-preview-copy-status]')?.textContent,
    ).toBe('Token copied.');
    // Element ids repeat across mounts, so each case owns the document alone.
    unmount();
    const failing = mount([minted()], {
      copyText: async () => {
        throw new Error('denied');
      },
    });
    await fill(failing.container);
    await click(buttonNamed(failing.container, 'Create preview'));
    await vi.waitFor(() =>
      expect(
        failing.container.querySelector('[data-cms-preview-token]'),
      ).not.toBeNull(),
    );
    await click(buttonNamed(failing.container, 'Copy token'));
    expect(
      failing.container.querySelector('[data-cms-preview-copy-status]')
        ?.textContent,
    ).toBe('Copying failed. Select the token and copy it yourself.');
  });

  it('renders a revoked token as text and hides the token on request', async () => {
    const { container } = mount([minted({ revoked: true })]);
    await fill(container);
    await click(buttonNamed(container, 'Create preview'));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-cms-preview-token]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-cms-preview-disclosure]')?.textContent,
    ).toContain('This token is revoked.');
    await click(buttonNamed(container, 'Hide token and create another'));
    expect(container.querySelector('[data-cms-preview-token]')).toBeNull();
    expect(byLabel<HTMLInputElement>(container, 'Audience').value).toBe('');
  });

  it('refetches and states why for an expired replay or a changed candidate', async () => {
    const expired = mount([
      jsonResponse(
        409,
        apiError('CONFLICT', { reasonCode: 'preview_expired' }),
      ),
    ]);
    await fill(expired.container);
    await click(buttonNamed(expired.container, 'Create preview'));
    await vi.waitFor(() =>
      expect(expired.container.querySelector('[role="alert"]')).not.toBeNull(),
    );
    expect(
      expired.container.querySelector('[role="alert"]')?.textContent,
    ).toContain('This preview has expired. Create a new preview.');
    expect(expired.refetch).toHaveBeenCalledTimes(1);
    expired.unmount();
    const stale = mount([
      jsonResponse(
        409,
        apiError('CONFLICT', { reasonCode: 'version_set_stale' }),
      ),
    ]);
    await fill(stale.container);
    await click(buttonNamed(stale.container, 'Create preview'));
    await vi.waitFor(() =>
      expect(stale.container.querySelector('[role="alert"]')).not.toBeNull(),
    );
    expect(
      stale.container.querySelector('[role="alert"]')?.textContent,
    ).toContain('The candidate changed. Review the updated candidate.');
  });

  it('refuses to send while the read behind it is not verified', async () => {
    const { container, fetcher } = mount([minted()], {
      disabledReason: 'Reload the page.',
    });
    await fill(container);
    await click(buttonNamed(container, 'Create preview'));
    await flush();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

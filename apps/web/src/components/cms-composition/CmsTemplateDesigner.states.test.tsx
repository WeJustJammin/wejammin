// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { PATTERN_REFUSAL_COPY } from '../cms-pattern-designer/pattern-designer-reasons';
import {
  templateSurfaces,
  type TemplateSurface,
} from './cms-template-result-heading.test-support';

/**
 * Slice 12 definition governance states, `commandState` column (FE03 1043-1049), for the template
 * create designer and the successor designer (CMS-03C-01). `loading` is proven in
 * CmsTemplateDesigner.pending.test.tsx; `empty` is "Not applicable" in the spec (no test).
 * The successor's unknown-outcome gate is proven in full in CmsTemplateEditDesigner.uncertain-pending.test.tsx;
 * the degraded cell is restated here as one tagged cell.
 */
let root: Root | null = null;
beforeAll(async () => {
  await import('./cms-registry-read');
  await loadCmsValidators();
});
afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount());
  root = null;
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const apiError = (code: string, details: Record<string, unknown> = {}) => ({
  code,
  message: 'Private provider detail must not reach the form.',
  requestId: '50000000-0000-4000-8000-000000000005',
  details,
});
const refusal = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
): Response => Response.json(apiError(code, details), { status });

const mountElement = async (
  element: React.ReactElement,
  fetcher: typeof fetch,
): Promise<HTMLDivElement> => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
};
const withProps = (
  surface: TemplateSurface,
  props: Record<string, unknown>,
): React.ReactElement => React.cloneElement(surface.element, props);
const nativeSubmit = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};
const commit = (container: HTMLElement): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
const region = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>('.cms-template-designer-status')!;
const posts = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
const returnToOf = (surface: TemplateSurface): string =>
  surface.name === 'create designer'
    ? '/app/cms-content-modeling/templates/new'
    : '/app/cms-content-modeling/templates/release-note';

describe.each(templateSurfaces)(
  'Template designer (CMS-03C-01) commandState: $name',
  (surface) => {
    it(`[P2-S12-AC-271] commandState idle: no result is shown, the unsent scoped draft is kept and nothing is sent (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi.fn<typeof fetch>();
      const container = await mountElement(surface.element, fetcher);
      expect(region(container).textContent).toBe('');
      expect(commit(container).disabled).toBe(false);
      await surface.prepare(container);
      expect(region(container).textContent).toBe('');
      expect(commit(container).disabled).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it(`[P2-S12-AC-271] commandState success: names the created draft, links its page, closes the draft and sends only the one write (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(surface.response());
      const container = await mountElement(surface.element, fetcher);
      await surface.prepare(container);
      await nativeSubmit(container);
      const heading = container.querySelector(
        '.cms-template-designer-status h3',
      );
      expect(heading?.textContent).toBe(surface.success);
      expect(region(container).getAttribute('role')).toBe('status');
      expect(region(container).textContent).toContain('Template ID');
      expect(region(container).textContent).toContain(
        'This is not a published template.',
      );
      expect(region(container).querySelector('a')?.getAttribute('href')).toBe(
        '/app/cms-content-modeling/templates/release-note',
      );
      expect(document.activeElement).toBe(heading);
      // The draft is closed: a second native submit sends nothing.
      await nativeSubmit(container);
      expect(posts(fetcher)).toHaveLength(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
      if (surface.name === 'create designer') {
        // The create form clears: "Start another draft" returns an empty draft.
        await act(async () => {
          Array.from(container.querySelectorAll('button'))
            .find((button) => button.textContent === 'Start another draft')!
            .click();
        });
        expect(
          container.querySelector<HTMLInputElement>('#cms-template-key')!.value,
        ).toBe('');
        expect(region(container).textContent).toBe('');
      } else {
        expect(commit(container).disabled).toBe(true);
      }
    });

    it(`[P2-S12-AC-271] commandState error: a 401 offers sign-in returning to the designer page and never a step-up route (CMS-03C-01 lists no STEP_UP_REQUIRED row) (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(refusal(401, 'UNAUTHENTICATED'));
      const container = await mountElement(surface.element, fetcher);
      await surface.prepare(container);
      await nativeSubmit(container);
      expect(region(container).getAttribute('role')).toBe('alert');
      expect(region(container).textContent).toContain(
        'Your session expired. Sign in again before submitting.',
      );
      expect(region(container).querySelector('a')?.getAttribute('href')).toBe(
        `/auth/sign-in?returnTo=${encodeURIComponent(returnToOf(surface))}`,
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
    });

    it(`[P2-S12-AC-271] commandState error: a 403 renders the CapabilityGate with the fixed designer-access copy as an alert, no step-up route (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(refusal(403, 'TEMPLATE_FORBIDDEN'));
      const container = await mountElement(surface.element, fetcher);
      await surface.prepare(container);
      await nativeSubmit(container);
      expect(region(container).getAttribute('role')).toBe('alert');
      expect(region(container).textContent).toContain(
        'Template designer access is required for this acting context.',
      );
      expect(
        region(container).querySelector('[data-cms-editorial-capability-gate]'),
      ).not.toBeNull();
      // FE03 CMS-11 "focus summary/field": a refusal keeps focus on the summary region, not on the gate heading.
      expect(document.activeElement).toBe(region(container));
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      expect(commit(container).disabled).toBe(false);
    });

    it(`[P2-S12-AC-271] commandState error: a 409 renders fixed conflict copy and keeps the draft; the block-registry token has its fixed reason copy; a version conflict refetches the key by itself, the digest token re-reads the designer context (D2, DEC-242, V19 M2) (CMS-03C-01 ${surface.name})`, async () => {
      const writes = [
        refusal(409, 'TEMPLATE_VERSION_CONFLICT'),
        refusal(409, 'TEMPLATE_VERSION_CONFLICT', {
          reasonCode: 'block_registry_digest_mismatch',
        }),
      ];
      const parent = (templateSurfaces[1]!.element.props as { detail: object })
        .detail;
      const latest =
        surface.name === 'create designer'
          ? { ...parent, version: '1', templateVersion: 1 }
          : parent;
      const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) =>
        init?.method === 'POST'
          ? Promise.resolve(writes.shift()!)
          : Promise.resolve(
              Response.json(latest, {
                status: 200,
                headers: {
                  etag: surface.name === 'create designer' ? '"1"' : '"2"',
                },
              }),
            ),
      );
      const container = await mountElement(surface.element, fetcher);
      await surface.prepare(container);
      await nativeSubmit(container);
      expect(region(container).getAttribute('role')).toBe('alert');
      expect(region(container).textContent).toContain(
        surface.name === 'create designer'
          ? 'The server reported a conflict. Review the existing template and refresh before making a different change.'
          : 'The server reported a conflict. Check the latest version and explicitly reconcile your unsent values before another submit.',
      );
      // The key is read by itself (once), and the control that repeats the read is offered.
      expect(
        Array.from(container.querySelectorAll('button')).some(
          (button) => button.textContent === 'Check latest version',
        ),
      ).toBe(true);
      if (surface.name !== 'create designer')
        // The successor's latest equals its parent, so the verified read lifts the hold (DEC-242 item 3).
        expect(commit(container).disabled).toBe(false);
      expect(
        container.querySelector<HTMLInputElement>('#cms-template-audience')!
          .value.length,
      ).toBeGreaterThan(0);
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === 'GET'),
      ).toHaveLength(1);
      await nativeSubmit(container);
      expect(region(container).textContent).toContain(
        PATTERN_REFUSAL_COPY.block_registry_digest_mismatch,
      );
      // The create designer has no template to compare for the closed registry-digest 409, so it reads no template
      // more; the successor reads its parent again, as it does for any 409. Both read the designer context (V19 M2).
      const reads = fetcher.mock.calls
        .filter(([, init]) => init?.method === 'GET')
        .map(([url]) => String(url));
      expect(
        reads.filter((url) => url !== '/api/v1/cms/templates/context'),
      ).toHaveLength(surface.name === 'create designer' ? 1 : 2);
      expect(
        reads.filter((url) => url === '/api/v1/cms/templates/context'),
      ).toHaveLength(1);
    });

    it(`[P2-S12-AC-271] commandState error: a 422 renders the fixed rejected copy in the result region and keeps the values (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(refusal(422, 'TEMPLATE_VALIDATION_FAILED'));
      const container = await mountElement(surface.element, fetcher);
      await surface.prepare(container);
      await nativeSubmit(container);
      expect(region(container).getAttribute('role')).toBe('alert');
      expect(region(container).textContent).toContain(
        'The server rejected the draft values. Review the form and try again.',
      );
      expect(commit(container).disabled).toBe(false);
      expect(
        container.querySelector<HTMLInputElement>('#cms-template-audience')!
          .value.length,
      ).toBeGreaterThan(0);
    });

    it(`[P2-S12-AC-271] commandState error: a 422 key_reserved renders its fixed copy at the template key field, links the summary to it and keeps the values (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        refusal(422, 'TEMPLATE_VALIDATION_FAILED', {
          reasonCode: 'key_reserved',
        }),
      );
      const container = await mountElement(surface.element, fetcher);
      await surface.prepare(container);
      await nativeSubmit(container);
      const key =
        container.querySelector<HTMLInputElement>('#cms-template-key')!;
      const message = container.querySelector('#cms-template-key-error');
      expect(message?.textContent).toBe(
        'This template key is reserved. Choose another key.',
      );
      expect(key.getAttribute('aria-invalid')).toBe('true');
      expect(key.getAttribute('aria-describedby')).toContain(
        'cms-template-key-error',
      );
      expect(
        region(container).querySelector('a[href="#cms-template-key"]'),
      ).not.toBeNull();
      expect(
        container.querySelector<HTMLInputElement>('#cms-template-audience')!
          .value.length,
      ).toBeGreaterThan(0);
    });

    it(`[P2-S12-AC-271] commandState disabled: with no protected form session the reason is stated and the commit control is off; the island takes no permittedNextActions (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi.fn<typeof fetch>();
      const container = await mountElement(
        withProps(surface, { csrfToken: '' }),
        fetcher,
      );
      expect(container.textContent).toContain(
        'Reload to restore the protected form session.',
      );
      expect(commit(container).disabled).toBe(true);
      await nativeSubmit(container);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it(`[P2-S12-AC-271] commandState disabled: with no active content type the reason is stated and the commit control is off (CMS-03C-01 ${surface.name})`, async () => {
      const fetcher = vi.fn<typeof fetch>();
      const element = withProps(surface, {
        context: {
          ...(surface.element.props as { context: object }).context,
          contentTypes: [],
        },
      });
      const container = await mountElement(element, fetcher);
      expect(commit(container).disabled).toBe(true);
      await nativeSubmit(container);
      expect(fetcher).not.toHaveBeenCalled();
      expect(container.textContent).toContain(
        'No active content types are available to this designer.',
      );
    });
  },
);

describe('Template designer (CMS-03C-01) commandState degraded', () => {
  const [create, successor] = templateSurfaces as [
    TemplateSurface,
    TemplateSurface,
  ];

  it('[P2-S12-AC-271] commandState degraded (successor): an unknown outcome claims no success, refetches by itself before any retry (a held read refuses every send: CmsTemplateEditDesigner.uncertain-pending.test.tsx), then replays the same Idempotency-Key (CMS-03C-01 successor designer)', async () => {
    let lost = false;
    const detail = (successor.element.props as { detail: object }).detail;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      if (init?.method === 'GET')
        return Promise.resolve(
          Response.json(detail, { status: 200, headers: { etag: '"2"' } }),
        );
      if (!lost) {
        lost = true;
        return Promise.reject(new Error('response lost after send'));
      }
      return Promise.resolve(successor.response());
    });
    const container = await mountElement(successor.element, fetcher);
    await successor.prepare(container);
    await nativeSubmit(container);
    expect(region(container).textContent).toContain('The result is unknown.');
    expect(region(container).textContent).not.toContain('Draft version saved');
    // The refetch ran by itself (DEC-242 item 3) before any retry was possible.
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'GET'),
    ).toHaveLength(1);
    expect(posts(fetcher)).toHaveLength(1);
    await nativeSubmit(container);
    expect(posts(fetcher)).toHaveLength(2);
    const [first, second] = posts(fetcher).map(([, init]) =>
      new Headers(init?.headers).get('idempotency-key'),
    );
    expect(second).toBe(first);
    expect(region(container).textContent).toContain('Draft version saved');
  });

  it('[P2-S12-AC-271] commandState degraded (create): an unknown outcome claims no success, reads the key by itself (404: nothing saved) before any retry, then replays the same Idempotency-Key (D3, DEC-242) (CMS-03C-01 create designer)', async () => {
    let lost = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      if (init?.method === 'GET')
        return Promise.resolve(refusal(404, 'TEMPLATE_NOT_FOUND'));
      if (!lost) {
        lost = true;
        return Promise.reject(new Error('response lost after send'));
      }
      return Promise.resolve(create.response());
    });
    const container = await mountElement(create.element, fetcher);
    await create.prepare(container);
    await nativeSubmit(container);
    expect(region(container).textContent).toContain(
      'The result is unknown. Check for an existing draft before retrying',
    );
    expect(region(container).textContent).not.toContain('Draft created');
    // The read of the key ran by itself, once, before the retry.
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'GET'),
    ).toHaveLength(1);
    await nativeSubmit(container);
    expect(posts(fetcher)).toHaveLength(2);
    const keys = posts(fetcher).map(([, init]) =>
      new Headers(init?.headers).get('idempotency-key'),
    );
    expect(keys[1]).toBe(keys[0]);
    expect(region(container).textContent).toContain('Draft created');
  });
});

// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import CmsEditorialCapabilityGate, {
  type CmsEditorialCapabilityGateProps,
} from './CmsEditorialCapabilityGate';

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const HEADING_ID = 'cms-editorial-gate-heading';

const mount = (
  props: CmsEditorialCapabilityGateProps,
): { readonly container: HTMLDivElement; readonly root: Root } => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<CmsEditorialCapabilityGate {...props} />));
  return { container, root };
};

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(() => {
  delete reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('CmsEditorialCapabilityGate', () => {
  it('is labelled by its heading and renders the typed reason verbatim', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      reason: 'You no longer have assignment to edit this entry.',
    });
    const section = container.querySelector<HTMLElement>(
      '[data-cms-editorial-capability-gate]',
    );
    expect(section?.getAttribute('aria-labelledby')).toBe(HEADING_ID);
    expect(document.getElementById(HEADING_ID)?.textContent).toBe(
      'Editing unavailable',
    );
    expect(container.textContent).toContain(
      'You no longer have assignment to edit this entry.',
    );
  });

  it('omits the reference line when no request id is supplied', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      reason: 'Editing is unavailable.',
    });
    expect(container.querySelector('.cms-editorial-request-id')).toBeNull();
    expect(container.textContent).not.toContain('Reference:');
  });

  it('shows the request id as a support reference when present', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      reason: 'Editing is unavailable.',
      requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
    });
    expect(
      container.querySelector('.cms-editorial-request-id')?.textContent,
    ).toBe('Reference: 018f0c45-73fe-7dc2-9c09-68f7ecf132da');
  });

  it('treats a null request id the same as an absent one', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      reason: 'Editing is unavailable.',
      requestId: null,
    });
    expect(container.querySelector('.cms-editorial-request-id')).toBeNull();
  });

  it('does not hint whether the hidden entry exists', () => {
    const { container } = mount({
      headingId: HEADING_ID,
      reason: 'You do not have access to this entry.',
    });
    const text = container.textContent?.toLowerCase() ?? '';
    expect(text).not.toContain('does not exist');
    expect(text).not.toContain('not found');
    expect(text).not.toContain('no such');
  });
});

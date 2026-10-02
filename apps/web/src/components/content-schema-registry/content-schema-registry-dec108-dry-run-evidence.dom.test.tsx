// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryActivationPreparation from './ContentSchemaRegistryActivationPreparation';
import {
  PREPARATION_JOB_ID,
  SEALED_REPORT_HASH,
  queuedDryRunPreparation,
  sealedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 "Accessibility Inventory": the dry-run status live region announces
 * queued, then the immutable sealed report with its counts and hashes read
 * from the server after the canonical refetch, without moving focus.
 */

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const jobBody = (state: string): Response =>
  new Response(
    JSON.stringify({
      id: PREPARATION_JOB_ID,
      type: 'cms.schema_dry_run',
      state,
      progress: null,
      resultRef: null,
      error: null,
      createdAt: '2026-10-02T12:00:00.000Z',
      updatedAt: '2026-10-02T12:00:01.000Z',
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', etag: '"2"' },
    },
  );

const render = (
  preparation: Parameters<
    typeof ContentSchemaRegistryActivationPreparation
  >[0]['preparation'],
  onCanonicalRefetch: () => void,
): void =>
  act(() =>
    root?.render(
      React.createElement(ContentSchemaRegistryActivationPreparation, {
        preparation,
        review: null,
        onCanonicalRefetch,
      }),
    ),
  );

const live = (): Element | null =>
  document.querySelector('[role="status"][aria-live="polite"]');

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe('[DEC-108] sealed report announcement', () => {
  it('[P2-S09-AC-1039] announces queued, then the sealed counts and hashes after the server refetch, without moving focus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jobBody('succeeded')),
    );
    const sentinel = document.createElement('button');
    (document.body as unknown as HTMLElement).appendChild(sentinel);
    sentinel.focus();
    const refetch = vi.fn();

    render(queuedDryRunPreparation, refetch);
    expect(live()?.textContent?.toLowerCase()).toContain('queued');
    expect(live()?.textContent).not.toMatch(/source row|hash/iu);

    await vi.waitFor(() => expect(refetch).toHaveBeenCalled(), {
      timeout: 3_000,
    });
    // The terminal job alone never announces a result or evidence.
    expect(live()?.textContent).not.toMatch(/passed|source row|hash/iu);

    render(sealedDryRunPreparation('passed'), refetch);
    const text = live()?.textContent ?? '';
    expect(text).toContain('The sealed dry run passed');
    expect(text).toContain('12 source rows');
    expect(text).toContain('0 row errors');
    expect(text).toContain(SEALED_REPORT_HASH);
    expect(live()?.getAttribute('aria-atomic')).toBe('true');
    expect(document.activeElement).toBe(sentinel);
    sentinel.remove();
  });

  it('[P2-S09-AC-1039] announces a sealed failed report from the server projection', () => {
    render(sealedDryRunPreparation('failed'), vi.fn());
    const text = live()?.textContent ?? '';
    expect(text).toContain('The sealed dry run failed');
    expect(text).toContain('3 row errors');
    expect(text).toContain(SEALED_REPORT_HASH);
  });
});

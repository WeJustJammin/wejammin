// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { summaryOf } from './CmsTaxonomyVersionList';
import { loadedVersions, versionFacts } from './taxonomy-designer.test-support';
import type { TaxonomyVersionsResult } from './taxonomy-versions-read';
import { useTaxonomyVersionRows } from './use-taxonomy-version-rows';

let root: Root | null = null;
let api: ReturnType<typeof useTaxonomyVersionRows> | null = null;
beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount());
  root = null;
  api = null;
});

const Probe = ({
  read,
}: {
  read: (id: string) => Promise<TaxonomyVersionsResult>;
}): null => {
  const current = useTaxonomyVersionRows(
    [summaryOf(versionFacts())],
    read as never,
  );
  React.useEffect(() => {
    api = current;
  });
  return null;
};
const mount = async (
  read: (id: string) => Promise<TaxonomyVersionsResult>,
): Promise<void> => {
  root = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () => root!.render(<Probe read={read} />));
};
const newer = versionFacts({ version: '3', taxonomyVersion: 3 });

describe('useTaxonomyVersionRows', () => {
  it('replaces the rows with a verified read and marks a failed one stale, keeping the rows it had', async () => {
    await mount(async () => loadedVersions([newer, versionFacts()]));
    await act(async () => api!.refresh('t'));
    expect(api!.rows.map((row) => row.version)).toEqual(['3', '2']);
    expect(api!.stale).toBe(false);
    root!.unmount();
    root = null;
    await mount(async () => ({ kind: 'unavailable' }));
    await act(async () => api!.refresh('t'));
    expect(api!.rows.map((row) => row.version)).toEqual(['2']);
    expect(api!.stale).toBe(true);
  });

  it('lets only the latest refetch answer: an earlier one that returns late is dropped', async () => {
    const answers: Array<(result: TaxonomyVersionsResult) => void> = [];
    await mount(
      () =>
        new Promise<TaxonomyVersionsResult>((resolve) => {
          answers.push(resolve);
        }),
    );
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    await act(async () => {
      first = api!.refresh('t');
      second = api!.refresh('t');
    });
    await act(async () => {
      answers[1]!(loadedVersions([newer, versionFacts()]));
      await second;
    });
    await act(async () => {
      answers[0]!(loadedVersions([versionFacts()]));
      await first;
    });
    expect(api!.rows.map((row) => row.version)).toEqual(['3', '2']);
  });

  it('adopts a read the designer already made, and ignores one that did not load', async () => {
    await mount(async () => ({ kind: 'unavailable' }));
    await act(async () => api!.adopt({ kind: 'unavailable' }));
    expect(api!.rows.map((row) => row.version)).toEqual(['2']);
    await act(async () => api!.adopt(loadedVersions([newer, versionFacts()])));
    expect(api!.rows.map((row) => row.version)).toEqual(['3', '2']);
    expect(api!.stale).toBe(false);
  });
});

// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { LocaleSourceRefreshResult } from './locale-source-refresh';
import { useLocaleSaveReconcile } from './use-locale-save-reconcile';
import { useLocaleSourceReview } from './use-locale-source-review';
import {
  ENTRY_ID,
  HASH,
  SOURCE_REVISION_ID,
} from './locale-variant.test-support';

let root: Root | null = null;
beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount());
  root = null;
});

const ready = (version: string): LocaleSourceRefreshResult => ({
  kind: 'ready',
  snapshot: {
    version,
    sourceRevisionId: SOURCE_REVISION_ID,
    sourceHash: HASH,
    texts: {},
  },
});
const BASE = {
  version: '4',
  sourceRevisionId: SOURCE_REVISION_ID,
  sourceHash: HASH,
};

type Api = {
  review: ReturnType<typeof useLocaleSourceReview>;
  reconcile: ReturnType<typeof useLocaleSaveReconcile>;
};
let api: Api | null = null;
const Probe = ({
  refresh,
  setVersion,
}: {
  refresh: () => Promise<LocaleSourceRefreshResult>;
  setVersion: (version: string) => void;
}): null => {
  const review = useLocaleSourceReview({
    entryId: ENTRY_ID,
    sourceLocale: 'en-US',
    fieldIds: [],
    refresh,
  });
  const reconcile = useLocaleSaveReconcile(review, setVersion);
  React.useEffect(() => {
    api = { review, reconcile };
  });
  return null;
};
const mount = async (
  refresh: () => Promise<LocaleSourceRefreshResult>,
  setVersion: (version: string) => void = () => undefined,
): Promise<void> => {
  root = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () =>
    root!.render(<Probe refresh={refresh} setVersion={setVersion} />),
  );
};

describe('the locale source read and its post-save reconcile', () => {
  it('drops the answer of a read that a later read superseded', async () => {
    const answers: Array<(result: LocaleSourceRefreshResult) => void> = [];
    await mount(
      () =>
        new Promise<LocaleSourceRefreshResult>((resolve) => {
          answers.push(resolve);
        }),
    );
    let early: Promise<LocaleSourceRefreshResult | null> =
      Promise.resolve(null);
    let late: Promise<LocaleSourceRefreshResult | null> = Promise.resolve(null);
    await act(async () => {
      early = api!.review.read();
      late = api!.review.read();
    });
    await act(async () => {
      answers[0]!(ready('4'));
      answers[1]!(ready('9'));
    });
    expect(await early).toBeNull();
    expect(await late).toEqual(ready('9'));
  });

  it('keeps the hold of an unknown outcome when its read was superseded, and does nothing to repeat a read it never made', async () => {
    const answers: Array<(result: LocaleSourceRefreshResult) => void> = [];
    await mount(
      () =>
        new Promise<LocaleSourceRefreshResult>((resolve) => {
          answers.push(resolve);
        }),
    );
    // Nothing was attempted yet, so there is nothing to read again.
    await act(async () => api!.reconcile.afterUnknown());
    expect(answers).toHaveLength(0);
    expect(api!.reconcile.unverified).toBe(false);
    let unknown: Promise<void> = Promise.resolve();
    await act(async () => {
      unknown = api!.reconcile.afterUnknown(BASE);
      // A second read supersedes the first (a person pressing the control).
      void api!.review.read();
    });
    await act(async () => {
      answers[0]!(ready('4'));
      answers[1]!(ready('4'));
      await unknown;
    });
    expect(api!.reconcile.unverified).toBe(true);
  });

  it('adopts a newer entry version of the same source after a confirmed save, and nothing when the read was superseded', async () => {
    const setVersion = vi.fn();
    await mount(async () => ready('8'), setVersion);
    await act(async () => api!.reconcile.afterSaved(BASE));
    expect(setVersion).toHaveBeenCalledWith('8');
  });
});

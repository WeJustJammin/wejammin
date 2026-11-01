// @vitest-environment jsdom
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { mount } from './taxonomy-designer-form.test-support';
import {
  createdFacts,
  submitStub,
  versionFacts,
} from './taxonomy-designer.test-support';
import {
  readTaxonomyVersionsOnDemand,
  taxonomyVersionsImporters,
} from './taxonomy-versions-on-demand';

/*
 * The failed-chunk path of the vocabulary versions read (review V20 m6, FE03 1048 `latestReadState` degraded): the read
 * loads its module only when a re-read needs it (`CMS_ON_DEMAND_CHUNKS`, the initial-route budget). A chunk that cannot
 * be fetched is the `unavailable` answer the callers already handle: the islands keep the last verified table and say
 * the list could not be refreshed, and nothing is requested from the network.
 */
const real = { ...taxonomyVersionsImporters };
beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  taxonomyVersionsImporters.read = real.read;
  vi.unstubAllGlobals();
});

const unfetchable = (): void => {
  taxonomyVersionsImporters.read = (() =>
    Promise.reject(new Error('chunk'))) as typeof real.read;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 })),
  );
};

describe('readTaxonomyVersionsOnDemand', () => {
  it('[P2-S12-AC-271] latestReadState degraded: a chunk that cannot be fetched answers unavailable and requests nothing', async () => {
    unfetchable();
    expect(await readTaxonomyVersionsOnDemand('taxonomy-id')).toEqual({
      kind: 'unavailable',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] latestReadState degraded: the vocabulary designer keeps its table and says the list could not be refreshed when the chunk cannot be fetched after a save', async () => {
    unfetchable();
    const { container } = mount({
      latest: versionFacts({
        version: '2',
        taxonomyVersion: 2,
        state: 'active',
      }),
      submit: submitStub({ kind: 'created', resource: createdFacts() }),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await vi.waitFor(() =>
      expect(container.textContent).toContain(
        'The version list could not be refreshed. Reload to see the new version.',
      ),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] latestReadState success: once the chunk can be fetched the same seam answers with the read', async () => {
    const answer = { kind: 'unavailable' } as const;
    taxonomyVersionsImporters.read = (async () => ({
      readTaxonomyVersions: async () => answer,
    })) as unknown as typeof real.read;
    expect(await readTaxonomyVersionsOnDemand('taxonomy-id')).toBe(answer);
  });
});

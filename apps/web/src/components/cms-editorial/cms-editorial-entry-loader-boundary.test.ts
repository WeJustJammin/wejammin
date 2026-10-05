import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_ENTRY_LOADER_BOUNDARY,
  cmsEditorialEntryLoaderStateFor,
  cmsEditorialEntryLoaderUnavailableState,
} from './cms-editorial-entry-loader-boundary';

describe('cms-editorial entry loader boundary', () => {
  it('declares the locally bound read and still-unwired editor loader', () => {
    expect(CMS_EDITORIAL_ENTRY_LOADER_BOUNDARY.status).toBe(
      'local-production-read-bound-editor-loader-unwired',
    );
    expect(CMS_EDITORIAL_ENTRY_LOADER_BOUNDARY.blocker).toContain(
      'authoring editor',
    );
    expect(CMS_EDITORIAL_ENTRY_LOADER_BOUNDARY.route).toBe(
      'GET /api/v1/cms/entries/{entryId}',
    );
  });

  it('renders an honest disabled state with a non-disclosing reason', () => {
    const state = cmsEditorialEntryLoaderUnavailableState();
    expect(state.status).toBe('disabled');
    expect(state.status === 'disabled' ? state.reason : null).toBe(
      'Editing is unavailable until the authoring draft loader is ready.',
    );
  });

  it('never fabricates a loaded draft from a denied or absent entry', () => {
    for (const status of [
      'unauthenticated',
      'forbidden',
      'not-found',
    ] as const) {
      const state = cmsEditorialEntryLoaderStateFor(
        { status },
        '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
        '2026-09-26T00:00:00.000Z',
      );
      expect(state.status).toBe('disabled');
      expect(state).not.toHaveProperty('data');
    }
  });

  it('maps an unavailable loader to degraded without inventing values', () => {
    const state = cmsEditorialEntryLoaderStateFor(
      { status: 'unavailable', retryable: true },
      '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
      '2026-09-26T00:00:00.000Z',
    );
    expect(state.status).toBe('degraded');
    expect(state).not.toHaveProperty('draft');
  });
});

import { describe, expect, it } from 'vitest';

import {
  cmsEditorialAppConflictPath,
  cmsEditorialAppEntryPath,
  cmsEditorialAppRevisionsPath,
} from './cms-editorial-app-routes';

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const CONFLICT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';

describe('CMS editorial app routes', () => {
  it('addresses the entry, its history and its conflict on app pages, never on the API', () => {
    expect(cmsEditorialAppEntryPath(ENTRY_ID)).toBe(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
    expect(cmsEditorialAppRevisionsPath(ENTRY_ID)).toBe(
      `/app/cms-content-modeling/entries/${ENTRY_ID}/revisions`,
    );
    expect(cmsEditorialAppConflictPath(ENTRY_ID, CONFLICT_ID)).toBe(
      `/app/cms-content-modeling/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
    );
  });

  it('refuses an id that is not a UUID instead of building a path from it', () => {
    for (const bad of ['', '../x', 'abc', `${ENTRY_ID}/../x`, '/api/v1']) {
      expect(cmsEditorialAppEntryPath(bad)).toBeNull();
      expect(cmsEditorialAppRevisionsPath(bad)).toBeNull();
      expect(cmsEditorialAppConflictPath(bad, CONFLICT_ID)).toBeNull();
      expect(cmsEditorialAppConflictPath(ENTRY_ID, bad)).toBeNull();
    }
  });
});

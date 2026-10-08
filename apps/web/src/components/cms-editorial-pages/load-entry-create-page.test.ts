import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  allKindFields,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryCreatePage } from './load-entry-create-page';

const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const apiError = (status: number, code: string) =>
  json(status, { code, message: 'x', requestId: REQUEST_ID, details: {} });

const reads = (authoringContext: CmsEditorialPageReads['authoringContext']) =>
  ({ authoringContext }) as unknown as CmsEditorialPageReads;

const page = (search = '') =>
  new Request(`https://web.test/app/cms-content-modeling/entries/new${search}`);

describe('loadEntryCreatePage', () => {
  it('lists the creatable types and selects none until one is chosen', async () => {
    const resource = AuthoringContextResourceSchema.parse({
      creatableTypes: [selectedType()],
      selectedType: null,
      fields: [],
    });
    const read = vi.fn(async () => json(200, resource));
    const outcome = await loadEntryCreatePage({
      request: page(),
      reads: reads(read),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(outcome.status).toBe(200);
    expect(outcome.heading).toBe('Create entry');
    expect(outcome.view.types).toHaveLength(1);
    expect(outcome.view.selected).toBeNull();
    expect(outcome.view.fields).toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('carries the selected type and its author-safe fields into the view', async () => {
    const resource = AuthoringContextResourceSchema.parse({
      creatableTypes: [selectedType()],
      selectedType: selectedType(),
      fields: allKindFields(),
    });
    const outcome = await loadEntryCreatePage({
      request: page('?contentTypeVersionId=x'),
      reads: reads(async () => json(200, resource)),
    });
    expect(outcome.kind === 'view' && outcome.view.fields).toHaveLength(14);
    expect(outcome.kind === 'view' && outcome.view.selected?.label).toBe(
      'Release note',
    );
  });

  it('states the prerequisite when the caller can author no type', async () => {
    const outcome = await loadEntryCreatePage({
      request: page(),
      reads: reads(async () =>
        json(200, { creatableTypes: [], selectedType: null, fields: [] }),
      ),
    });
    expect(outcome.kind).toBe('view');
    expect(outcome.kind === 'view' && outcome.view.types).toEqual([]);
  });

  it('returns an expired session to this exact page, query included', async () => {
    const outcome = await loadEntryCreatePage({
      request: page('?contentTypeVersionId=abc'),
      reads: reads(async () => apiError(401, 'UNAUTHENTICATED')),
    });
    expect(outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(
        '/app/cms-content-modeling/entries/new?contentTypeVersionId=abc',
      )}`,
    });
  });

  it.each([
    [403, 'Access denied'],
    [404, 'Not found'],
    [422, 'Invalid request'],
    [503, 'Temporarily unavailable'],
  ])(
    'renders a %i as a closed state, never a form that could not commit',
    async (status, heading) => {
      const outcome = await loadEntryCreatePage({
        request: page(),
        reads: reads(async () => apiError(status, 'X')),
      });
      expect(outcome.kind).toBe('notice');
      expect(outcome.kind === 'notice' && outcome.notice.heading).toBe(heading);
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(status);
    },
  );

  it('refuses a 200 that is not the strict contract instead of rendering from it', async () => {
    const outcome = await loadEntryCreatePage({
      request: page(),
      reads: reads(async () => json(200, { creatableTypes: 'no' })),
    });
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});

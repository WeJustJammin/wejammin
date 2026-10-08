import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  allKindFields,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  SCHEMA_VERSION_ID,
  TITLE,
  apiError,
  draftDetail,
  editorFields,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryEditPage } from './load-entry-edit-page';

const page = (path = `/app/cms-content-modeling/entries/${ENTRY_ID}`) =>
  new Request(`https://web.test${path}`);

const context = (fields: readonly unknown[] = editorFields()) =>
  new Response(
    JSON.stringify(
      AuthoringContextResourceSchema.parse({
        creatableTypes: [selectedType()],
        selectedType: selectedType(),
        fields,
      }),
    ),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const reads = (parts: Partial<CmsEditorialPageReads>): CmsEditorialPageReads =>
  parts as CmsEditorialPageReads;

const detail = (extra: Record<string, unknown> = {}) =>
  draftDetail({
    entryVersion: '4',
    revisionNumber: '2',
    values: { [TITLE]: 'Release notes' },
    ...extra,
  } as never);

describe('loadEntryEditPage', () => {
  it('builds the editor from the verified draft and the author-safe definitions of its schema version', async () => {
    const authoringContext = vi.fn(async () => context());
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({ draftDetail: async () => detail(), authoringContext }),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view' || outcome.view.kind !== 'editor') return;
    const init = outcome.view.init;
    expect(init).toMatchObject({
      entryId: ENTRY_ID,
      entryVersion: '4',
      baseRevision: '2',
      locale: 'en-US',
      schemaVersionId: SCHEMA_VERSION_ID,
      lifecycle: 'active',
      state: 'draft',
      validationState: 'valid',
      openConflict: null,
    });
    expect(init.values[TITLE]).toBe('Release notes');
    expect(init.values[BLURB]).toBeNull();
    expect(init.fields).toHaveLength(editorFields().length);
    // The definitions are read for the DRAFT's schema version, not a caller choice.
    expect(authoringContext).toHaveBeenCalledWith(
      expect.any(Request),
      SCHEMA_VERSION_ID,
    );
    expect(outcome.heading).toBe('Edit entry');
  });

  it('carries the open conflict identity so the editor can link to its resolution', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () =>
          detail({ openConflict: { conflictId: CONFLICT_ID, version: '2' } }),
        authoringContext: async () => context(),
      }),
    });
    expect(
      outcome.kind === 'view' &&
        outcome.view.kind === 'editor' &&
        outcome.view.init.openConflict,
    ).toEqual({
      conflictId: CONFLICT_ID,
      version: '2',
    });
  });

  it('serialises no owner, assignee or authority identifier into the island data', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () => context(allKindFields()),
      }),
    });
    const text = JSON.stringify(outcome);
    for (const name of [
      'ownerId',
      'assigneeId',
      'actingPartyId',
      'capability',
      'authorPersonId',
    ])
      expect(text).not.toContain(name);
  });

  it('answers a malformed entry id as an invalid request without any upstream call', async () => {
    const draft = vi.fn();
    const outcome = await loadEntryEditPage({
      request: page('/app/cms-content-modeling/entries/not-a-uuid'),
      entryId: 'not-a-uuid',
      reads: reads({ draftDetail: draft }),
    });
    expect(draft).not.toHaveBeenCalled();
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 400,
      heading: 'Invalid request',
    });
  });

  it('returns an expired session to this exact page', async () => {
    const outcome = await loadEntryEditPage({
      request: page(
        `/app/cms-content-modeling/entries/${ENTRY_ID}?locale=fr-FR`,
      ),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => apiError(401, 'UNAUTHENTICATED'),
      }),
    });
    expect(outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(
        `/app/cms-content-modeling/entries/${ENTRY_ID}?locale=fr-FR`,
      )}`,
    });
  });

  it.each([
    [403, 'Access denied'],
    [404, 'Not found'],
    [503, 'Temporarily unavailable'],
  ])(
    'renders a %i from the draft read as one closed state',
    async (status, heading) => {
      const outcome = await loadEntryEditPage({
        request: page(),
        entryId: ENTRY_ID,
        reads: reads({ draftDetail: async () => apiError(status, 'X') }),
      });
      expect(outcome.kind === 'notice' && outcome.notice.heading).toBe(heading);
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(status);
    },
  );

  it('refuses a 200 draft that is not the strict contract', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () =>
          new Response(JSON.stringify({ entry: 'x' }), { status: 200 }),
      }),
    });
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });

  it('keeps the page readable but states that editing is unavailable when the definitions cannot be loaded', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () => apiError(403, 'FORBIDDEN'),
      }),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view' || outcome.view.kind !== 'unavailable') return;
    expect(outcome.view.message).toContain('cannot be edited');
    expect(outcome.status).toBe(200);
    expect(outcome.view.facts.lifecycle).toBe('active');
  });

  it('is a degraded page when the definitions read is down, and redirects an expired session there too', async () => {
    const degraded = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () => apiError(503, 'DEPENDENCY_UNAVAILABLE'),
      }),
    });
    expect(degraded.kind === 'view' && degraded.status).toBe(503);
    const expired = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () => apiError(401, 'UNAUTHENTICATED'),
      }),
    });
    expect(expired.kind).toBe('redirect');
  });
});

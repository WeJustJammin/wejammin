import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { conflictDetailBody } from '../cms-editorial/cms-editorial-conflict-fixtures.test-support';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  SCHEMA_VERSION_ID,
  TITLE,
  apiError,
  editorFields,
  json,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import { selectedType } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadConflictPage } from './load-conflict-page';

const page = () =>
  new Request(
    `https://web.test/app/cms-content-modeling/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
  );

const reads = (parts: Partial<CmsEditorialPageReads>) =>
  parts as CmsEditorialPageReads;

const definitions = (fields = editorFields()) =>
  json(
    200,
    AuthoringContextResourceSchema.parse({
      creatableTypes: [selectedType()],
      selectedType: selectedType(),
      fields,
    }),
  );

const detail = () =>
  json(
    200,
    conflictDetailBody({
      paths: [
        {
          fieldId: TITLE,
          base: { value: 'a' },
          theirs: { value: 'b' },
          yours: { value: 'c' },
        },
        {
          fieldId: BLURB,
          base: { value: null },
          theirs: { value: 'd' },
          yours: { value: 'e' },
        },
      ],
    }),
  );

describe('loadConflictPage', () => {
  it('builds the resolution form from the verified conflict and the definitions of its schema version', async () => {
    const authoringContext = vi.fn(async () => definitions());
    const outcome = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({ conflictDetail: async () => detail(), authoringContext }),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(outcome.heading).toBe('Resolve edit conflict');
    expect(outcome.view.init).toMatchObject({
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      entryVersion: '6',
      baseRevision: '2',
    });
    expect(outcome.view.init.paths.map((path) => path.fieldId)).toEqual([
      TITLE,
      BLURB,
    ]);
    expect(authoringContext).toHaveBeenCalledWith(
      expect.any(Request),
      SCHEMA_VERSION_ID,
    );
  });

  it('serialises no owner, resolver or authority identifier', async () => {
    const outcome = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({
        conflictDetail: async () => detail(),
        authoringContext: async () => definitions(),
      }),
    });
    for (const name of [
      'resolvedByPersonId',
      'ownerId',
      'assigneeId',
      'capability',
    ])
      expect(JSON.stringify(outcome)).not.toContain(name);
  });

  it.each([
    ['entry', 'not-a-uuid', CONFLICT_ID],
    ['conflict', ENTRY_ID, 'nope'],
  ])(
    'answers a malformed %s id as an invalid request without an upstream call',
    async (_which, entryId, conflictId) => {
      const read = vi.fn();
      const outcome = await loadConflictPage({
        request: page(),
        entryId,
        conflictId,
        reads: reads({ conflictDetail: read }),
      });
      expect(read).not.toHaveBeenCalled();
      expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
        status: 400,
        heading: 'Invalid request',
      });
    },
  );

  it.each([
    [403, 'Access denied'],
    [404, 'Not found'],
    [503, 'Temporarily unavailable'],
  ])(
    'renders a %i of the conflict read as one closed state',
    async (status, heading) => {
      const outcome = await loadConflictPage({
        request: page(),
        entryId: ENTRY_ID,
        conflictId: CONFLICT_ID,
        reads: reads({ conflictDetail: async () => apiError(status, 'X') }),
      });
      expect(outcome.kind === 'notice' && outcome.notice.heading).toBe(heading);
    },
  );

  it('says the conflict is not open for a hidden, absent or closed one, with nothing more', async () => {
    const outcome = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({ conflictDetail: async () => apiError(404, 'NOT_FOUND') }),
    });
    expect(outcome.kind === 'notice' && outcome.notice.message).toBe(
      'This conflict is not open.',
    );
  });

  it('refuses a 200 for another conflict or one that is not the strict contract', async () => {
    const other = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({
        conflictDetail: async () =>
          json(
            200,
            conflictDetailBody({
              conflictId: '018f0c45-73fe-7dc2-9c09-68f7ecf13200',
            }),
          ),
      }),
    });
    expect(other.kind === 'notice' && other.notice.status).toBe(502);
  });

  it('cannot be resolved here when a field of the conflict has no definition', async () => {
    const outcome = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({
        conflictDetail: async () => detail(),
        authoringContext: async () => definitions(editorFields().slice(0, 1)),
      }),
    });
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });

  it('closes the page when the definitions are not available and redirects an expired session', async () => {
    const denied = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({
        conflictDetail: async () => detail(),
        authoringContext: async () => apiError(403, 'FORBIDDEN'),
      }),
    });
    expect(denied.kind === 'notice' && denied.notice.status).toBe(403);
    const expired = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({
        conflictDetail: async () => apiError(401, 'UNAUTHENTICATED'),
      }),
    });
    expect(expired.kind).toBe('redirect');
  });
});

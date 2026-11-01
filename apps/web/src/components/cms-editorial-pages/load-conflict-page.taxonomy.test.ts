/**
 * Slice 12 typed conflict editor / taxonomy loader integration regression.
 * Adjacent to P2-S12-AC-135 but not it: that criterion names CMS-03B-01/10/11
 * value authoring, while this is the CMS-06 (CMS-03B-02) conflict resolution
 * editor. It claims no acceptance checkbox or depth credit.
 *
 * FE03 `CmsTaxonomyFieldEditor` requires the label for the ENTRY locale
 * (`fe/03-cms-content-modeling.md` line 890) and BE03c CMS-03C-17 returns only
 * the requested locale's label with no fallback, so a content type's default
 * locale cannot stand in for the conflict revision's locale; the locked conflict
 * detail omits the locale. For a DIVERGENT taxonomy field the loader therefore
 * re-reads the conflict's own `theirs` revision through the existing protected
 * CMS-03B-15 workflow read -- the same `cms_authority_origin` scope as the
 * conflict detail -- deriving a GET that carries only the server-derived
 * `revisionId` and the page's session headers, and binds the full resource to
 * the conflict's theirs reference before it fills the init taxonomy context.
 *
 * These drive the REAL `loadConflictPage` with the REAL contract schemas and
 * only the injected `CmsEditorialPageReads` replaced, so no parsing or loader
 * logic is mocked. They are RED until the loader composes the workflow read; the
 * init extension is probed as an optional member so the suite still collects.
 */

import {
  EntryWorkflowResourceSchema,
  type EntryWorkflowResource,
} from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CmsEditorialConflictResolveInit } from '../cms-editorial/cms-editorial-conflict-state';
import { json } from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  HASH_B,
  NON_TAXONOMY_PATH,
  OTHER_ID,
  REVISION_LOCALE,
  SCHEMA_VERSION_ID,
  TAXONOMY_PATH,
  THEIRS_REVISION_ID,
  THEIRS_REVISION_NUMBER,
  TYPE_KEY,
  conflictDetailResponse,
  definitionsResponse,
  entry,
  fieldsWithoutTaxonomy,
  revision,
  workflow,
  workflowRefusal,
  workflowResponse,
} from './conflict-taxonomy-loader.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadConflictPage } from './load-conflict-page';

const ADDRESS = `https://web.test/app/cms-content-modeling/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`;
const SESSION = 'wj_access=a; wj_csrf=c';

const page = (search = '') =>
  new Request(`${ADDRESS}${search}`, { headers: { cookie: SESSION } });

const reads = (parts: Partial<CmsEditorialPageReads>): CmsEditorialPageReads =>
  parts as CmsEditorialPageReads;

const workflowRead = (response: Response | (() => Response)) =>
  vi.fn<(request: Request, entryId: string) => Promise<Response>>(async () =>
    typeof response === 'function' ? response() : response,
  );

/** The planned optional init extension, absent from the loader until GREEN. */
interface TaxonomyContext {
  readonly typeKey: string;
  readonly locale: string;
  readonly theirs: {
    readonly revisionId: string;
    readonly revisionNumber: string;
    readonly schemaVersionId: string;
    readonly contentHash: string;
  };
}
type InitWithTaxonomy = CmsEditorialConflictResolveInit & {
  readonly taxonomyContext?: TaxonomyContext;
};

const initOf = (
  outcome: Awaited<ReturnType<typeof loadConflictPage>>,
): InitWithTaxonomy | null =>
  outcome.kind === 'view' ? (outcome.view.init as InitWithTaxonomy) : null;

const divergent = () =>
  conflictDetailResponse([NON_TAXONOMY_PATH, TAXONOMY_PATH]);

const load = (
  workflowMock: ReturnType<typeof workflowRead>,
  detail: Response = divergent(),
  definitions: Response = definitionsResponse(),
) =>
  loadConflictPage({
    request: page(),
    entryId: ENTRY_ID,
    conflictId: CONFLICT_ID,
    reads: reads({
      conflictDetail: async () => detail,
      authoringContext: async () => definitions,
      workflow: workflowMock,
    }),
  });

describe('loadConflictPage: the divergent taxonomy field', () => {
  it('re-reads the conflict theirs revision and fills the init taxonomy context', async () => {
    const workflowMock = workflowRead(workflowResponse(workflow()));
    const outcome = await load(workflowMock);

    expect(workflowMock).toHaveBeenCalledTimes(1);
    const derived = workflowMock.mock.calls[0]![0];
    const url = new URL(derived.url);
    expect(derived.method).toBe('GET');
    expect(url.pathname).toBe(`/api/v1/cms/entries/${ENTRY_ID}/workflow`);
    // Only the server-derived revision, never a page-supplied member.
    expect([...url.searchParams]).toEqual([['revisionId', THEIRS_REVISION_ID]]);
    expect(derived.headers.get('cookie')).toBe(SESSION);
    expect(workflowMock).toHaveBeenCalledWith(expect.any(Request), ENTRY_ID);

    expect(outcome.kind).toBe('view');
    const init = initOf(outcome);
    expect(init?.taxonomyContext).toEqual({
      typeKey: TYPE_KEY,
      locale: REVISION_LOCALE,
      theirs: {
        revisionId: THEIRS_REVISION_ID,
        revisionNumber: THEIRS_REVISION_NUMBER,
        schemaVersionId: SCHEMA_VERSION_ID,
        contentHash: HASH,
      },
    });
    // The page's entry version may advance independently of the revision read.
    expect(init?.entryVersion).toBe('6');
  });

  it('accepts a non-current historical revision and takes the locale from it', async () => {
    const historical = workflow({
      revision: revision({ state: 'approved', isCurrentDraft: false }),
      preparation: null,
      permittedNextActions: ['schedule', 'preview', 'publish'],
    });
    expect(EntryWorkflowResourceSchema.safeParse(historical).success).toBe(
      true,
    );
    const init = initOf(await load(workflowRead(workflowResponse(historical))));
    expect(init?.taxonomyContext?.locale).toBe(REVISION_LOCALE);
    expect(init?.taxonomyContext?.theirs.revisionNumber).toBe(
      THEIRS_REVISION_NUMBER,
    );
  });
});

describe('loadConflictPage: no divergent taxonomy field needs the locale', () => {
  it('does not read the workflow for a divergent field that is not a taxonomy', async () => {
    const workflowMock = workflowRead(workflowResponse(workflow()));
    const outcome = await load(
      workflowMock,
      conflictDetailResponse([NON_TAXONOMY_PATH]),
      definitionsResponse(fieldsWithoutTaxonomy()),
    );
    expect(workflowMock).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('view');
    expect(initOf(outcome)?.taxonomyContext).toBeUndefined();
  });

  it('does not read the workflow when the taxonomy field is defined but not divergent', async () => {
    const workflowMock = workflowRead(workflowResponse(workflow()));
    const outcome = await load(
      workflowMock,
      conflictDetailResponse([NON_TAXONOMY_PATH]),
    );
    expect(workflowMock).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('view');
    expect(initOf(outcome)?.taxonomyContext).toBeUndefined();
  });

  it('never lets a page query choose the revision: a query is refused before any read', async () => {
    const workflowMock = workflowRead(workflowResponse(workflow()));
    const conflictDetail = vi.fn(async () => divergent());
    const outcome = await loadConflictPage({
      request: page(`?revisionId=${OTHER_ID}`),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({ conflictDetail, workflow: workflowMock }),
    });
    expect(conflictDetail).not.toHaveBeenCalled();
    expect(workflowMock).not.toHaveBeenCalled();
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
  });
});

describe('loadConflictPage: the workflow must bind the conflict theirs revision', () => {
  const mismatches: [string, () => EntryWorkflowResource][] = [
    ['another entry', () => workflow({ entry: entry(OTHER_ID) })],
    [
      'another revision id',
      () => workflow({ revision: revision({ id: OTHER_ID }) }),
    ],
    [
      'another revision number',
      () => workflow({ revision: revision({ revisionNumber: '9' }) }),
    ],
    [
      'another schema version',
      () => workflow({ revision: revision({ schemaVersionId: OTHER_ID }) }),
    ],
    [
      'another content hash',
      () =>
        workflow({
          revision: revision({ contentHash: HASH_B }),
          preparation: null,
        }),
    ],
  ];

  it.each(mismatches)(
    'refuses a standalone-valid workflow that names %s as the unverified state',
    async (_case, build) => {
      const resource = build();
      // The resource alone is the strict contract; only the binding refuses it.
      expect(EntryWorkflowResourceSchema.safeParse(resource).success).toBe(
        true,
      );
      const outcome = await load(workflowRead(workflowResponse(resource)));
      expect(outcome.kind).toBe('notice');
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
    },
  );
});

describe('loadConflictPage: an unverified or refused workflow read', () => {
  it.each([
    [
      'a body that is not JSON',
      () => new Response('not json', { status: 200 }),
    ],
    ['a body that is not the workflow contract', () => json(200, { entry: 1 })],
  ] as [string, () => Response][])(
    'renders %s as the existing unverified state',
    async (_case, build) => {
      const outcome = await load(workflowRead(build));
      expect(outcome.kind).toBe('notice');
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
    },
  );

  it.each([403, 404, 429, 503])(
    'renders a %i of the workflow read as one closed state',
    async (status) => {
      const outcome = await load(workflowRead(workflowRefusal(status)));
      expect(outcome.kind).toBe('notice');
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(status);
    },
  );

  it('returns an expired session of the workflow read as a sign-in redirect', async () => {
    const outcome = await load(
      workflowRead(new Response(null, { status: 401 })),
    );
    expect(outcome.kind).toBe('redirect');
  });
});

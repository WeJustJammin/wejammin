import type {
  CmsEditorialAsyncState,
  CmsEditorialEntryDraft,
} from './cms-editorial-types';

/**
 * BOUNDARY: authorised entry-draft loader for CMS-05.
 *
 * This used to read that no locked 03b route returned entry or revision
 * values. That became false: BE03b registers CMS-03B-11
 * `GET /api/v1/cms/entries/{entryId}` returning `EntryDraftDetailResource`,
 * which does carry authorized schema-typed draft values
 * (.memory/wiki/specs/be/03b-editorial-workflow-publication.md:96,159,700,840),
 * and packages/contracts/src/cms-editorial/ implements and registers it.
 *
 * The web transport now exists:
 * apps/web/src/server/cms-editorial-platform-reads.ts forwards the protected
 * read through the private PLATFORM_API binding. The Worker serves the
 * protected GET route and named production getEntryDraft port. The authoring
 * workbench loader is still unimplemented; a metadata-only page read is not a
 * working editor, so the loader remains fail-closed without fabricating values.
 */

export const CMS_EDITORIAL_ENTRY_LOADER_BOUNDARY = {
  status: 'local-production-read-bound-editor-loader-unwired',
  route: 'GET /api/v1/cms/entries/{entryId}',
  blocker:
    'The CMS-03B-11 proxy, protected Worker route, and production RPC adapter are implemented locally, but the authoring editor has no verified draft loader or hosted acceptance.',
  owner: '03b-editorial-workflow-publication.md',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
} as const;

export type CmsEditorialEntryLoadResult =
  | { readonly status: 'loaded'; readonly draft: CmsEditorialEntryDraft }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'forbidden' }
  | { readonly status: 'not-found' }
  | { readonly status: 'unavailable'; readonly retryable: boolean };

export interface CmsEditorialEntryLoader {
  readonly loadEntryDraft: (input: {
    readonly entryId: string;
    readonly actorId: string;
    readonly actingPartyId: string;
  }) => Promise<CmsEditorialEntryLoadResult>;
}

/**
 * Safe copy for the disabled editor. The reason is a fixed, non-disclosing
 * string: a denied entry must not be distinguishable from an absent one.
 */
export const cmsEditorialEntryLoaderUnavailableState =
  (): CmsEditorialAsyncState<never> => ({
    status: 'disabled',
    reason: 'Editing is unavailable until the authoring draft loader is ready.',
  });

export const cmsEditorialEntryLoaderStateFor = (
  result: CmsEditorialEntryLoadResult,
  requestId: string,
  now: string,
): CmsEditorialAsyncState<never> => {
  if (result.status === 'unavailable')
    return {
      status: 'degraded',
      data: null,
      requestId,
      lastVerifiedAt: now,
    };
  return cmsEditorialEntryLoaderUnavailableState();
};

import {
  CmsPatternKeySchema,
  PatternVersionDetailSchema,
  TemplateDesignerContextSchema,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialSignInRedirect,
  cmsEditorialUnverifiedNotice,
} from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import type { GovernedPatternFacts } from '../cms-governed-review/CmsGovernedPatternPanel';
import { readCmsTemplateContext } from '../../server/cms-composition-platform-context';
import { cmsEditorialCsrfCookie } from '../../server/cms-editorial-platform-shared';
import { readCmsPatternLatest } from '../../server/cms-pattern-platform-latest';
import type { PatternDesignerContext } from './pattern-designer-request';
import type { PatternLatestDetail } from './pattern-latest-read';

export const PATTERN_NEW_PATH = '/app/cms-content-modeling/patterns/new';
export const patternPagePath = (patternKey: string): string =>
  `/app/cms-content-modeling/patterns/${patternKey}`;

/**
 * The protected reads a pattern page performs, behind one seam. The Astro pages build
 * it from the PLATFORM_API binding; the loader takes it as a parameter, so a loader
 * test drives the real parsing and view logic with only the proxy edge replaced.
 */
export interface PatternDesignerPageReads {
  /** `cmsTemplateContextRead`: the active types and registered blocks. */
  readonly context: (request: Request) => Promise<Response>;
  /** `cmsPatternLatestRead`: the owner's latest version of a key. */
  readonly latest: (request: Request, patternKey: string) => Promise<Response>;
}

/** A GET with only the session headers of the page request: its URL state never leaks into a read. */
const derivedRead = (request: Request, path: string): Request =>
  new Request(new URL(path, request.url), {
    method: 'GET',
    headers: request.headers,
  });

export const createPatternDesignerPageReads = (
  binding: unknown,
): PatternDesignerPageReads => ({
  context: (request) =>
    readCmsTemplateContext(
      derivedRead(request, '/api/v1/cms/templates/context'),
      binding,
    ),
  latest: (request, patternKey) =>
    readCmsPatternLatest(
      derivedRead(request, `/api/v1/cms/patterns/${patternKey}`),
      binding,
      patternKey,
    ),
});

export interface PatternDesignerPageView {
  readonly mode: 'create' | 'edit';
  /** Only the selectors the form renders; no version, locale or owner member. */
  readonly context: PatternDesignerContext;
  readonly latest: PatternLatestDetail | null;
  /** The few members the governed review panel needs, for a saved pattern. */
  readonly panel: GovernedPatternFacts | null;
  readonly csrfToken: string;
}

const notice = (
  status: number,
  title: string,
  message: string,
  retryHref: string | null = null,
): CmsEditorialPageOutcome<never> => ({
  kind: 'notice',
  notice: {
    status,
    title,
    heading: title,
    message,
    retryHref,
    requestId: null,
  },
});

const failureOutcome = async (
  response: Response,
  returnTo: string,
): Promise<CmsEditorialPageOutcome<never>> => {
  if (response.status === 403)
    return notice(
      403,
      'Access denied',
      'Template designer access is required for the current acting context.',
    );
  if (response.status === 404)
    return notice(
      404,
      'Not found',
      'This pattern is unavailable to the current acting context.',
    );
  return cmsEditorialNoticeFor(response, {
    subject: 'entry',
    returnTo,
    retryHref: returnTo,
  }) as Promise<CmsEditorialPageOutcome<never>>;
};

const jsonOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

/**
 * The protected pattern designer pages (FE03 :1067). `patternKey` is null on `/patterns/new`
 * and the path key on `/patterns/:patternKey`. A malformed key and the reserved keys
 * (`context`, `versions`, `selector`, `new`) are a 400 before any protected read; a
 * concealed or absent key is the disclosure-safe 404; a visible key without the
 * capability is a 403; an expired session is a sign-in redirect. No form is ever built
 * from a projection the strict contracts did not verify.
 */
export const loadPatternDesignerPage = async (input: {
  readonly request: Request;
  readonly patternKey: string | null;
  readonly reads: PatternDesignerPageReads;
}): Promise<CmsEditorialPageOutcome<PatternDesignerPageView>> => {
  const { request, reads } = input;
  const key =
    input.patternKey === null
      ? null
      : CmsPatternKeySchema.safeParse(input.patternKey);
  if (key !== null && !key.success)
    return notice(
      400,
      'Invalid request',
      'This pattern address could not be read. Check it and try again.',
      '/app/cms-content-modeling',
    );
  const patternKey = key === null || !key.success ? null : key.data;
  const returnTo =
    patternKey === null ? PATTERN_NEW_PATH : patternPagePath(patternKey);

  const [contextResponse, latestResponse] = await Promise.all([
    reads.context(request),
    patternKey === null
      ? Promise.resolve(null)
      : reads.latest(request, patternKey),
  ]);
  if (contextResponse.status === 401 || latestResponse?.status === 401)
    return cmsEditorialSignInRedirect(returnTo);
  // A saved pattern's own answer explains first (its 404 hides an absent key).
  const failed =
    latestResponse !== null && latestResponse.status !== 200
      ? latestResponse
      : contextResponse.status !== 200
        ? contextResponse
        : null;
  if (failed !== null) return failureOutcome(failed, returnTo);

  const context = TemplateDesignerContextSchema.safeParse(
    await jsonOf(contextResponse),
  );
  if (!context.success) return cmsEditorialUnverifiedNotice('Pattern');
  const designerContext: PatternDesignerContext = {
    contentTypes: context.data.contentTypes.map(({ id, typeKey }) => ({
      id,
      typeKey,
    })),
    registeredBlocks: context.data.registeredBlocks,
  };
  const csrfToken = cmsEditorialCsrfCookie(request) ?? '';
  if (latestResponse === null)
    return {
      kind: 'view',
      status: 200,
      title: 'Pattern',
      heading: 'Pattern designer',
      description: 'Define a reusable pattern and submit it for review.',
      view: {
        mode: 'create',
        context: designerContext,
        latest: null,
        panel: null,
        csrfToken,
      },
    };

  const detail = PatternVersionDetailSchema.safeParse(
    await jsonOf(latestResponse),
  );
  if (
    !detail.success ||
    detail.data.patternKey !== patternKey ||
    detail.data.version !== String(detail.data.patternVersion) ||
    latestResponse.headers.get('etag') !== `"${detail.data.version}"`
  )
    return cmsEditorialUnverifiedNotice('Pattern');
  const { data } = detail;
  return {
    kind: 'view',
    status: 200,
    title: 'Pattern',
    heading: 'Edit pattern draft',
    description: 'Define a reusable pattern and submit it for review.',
    view: {
      mode: 'edit',
      context: designerContext,
      latest: {
        id: data.id,
        version: data.version,
        contentHash: data.contentHash,
        state: data.state,
        patternKey: data.patternKey,
        patternVersion: data.patternVersion,
        compatibleTypeIds: data.compatibleTypeIds,
        nodeCount: data.nodeCount,
        blockRegistryDigest: data.blockRegistryDigest,
        blockTree: data.blockTree,
      },
      panel: {
        id: data.id,
        contentHash: data.contentHash,
        patternKey: data.patternKey,
        patternVersion: data.patternVersion,
        state: data.state,
      },
      csrfToken,
    },
  };
};

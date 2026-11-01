import {
  TemplateDesignerContextSchema,
  TemplateVersionDetailSchema,
  type TemplateDesignerContext,
  type TemplateVersionDetail,
} from '@wejammin/contracts';

import { cmsTemplateUnavailableCopy } from './cms-template-unavailable-copy';

/*
 * What the two protected template pages (`templates/new.astro`, `templates/[templateKey].astro`) do with the answers
 * of `cmsTemplateContextRead` (and, for a successor, `cmsTemplateDetailRead`) before they hydrate a form
 * (P2-S12-AC-164: no form, so no submission, unless the context was read and verified). Server-side only: nothing here
 * reaches a browser bundle. The sentences are written here, never taken from a response.
 */
export type TemplatePageOutcome<Ready> =
  | { readonly kind: 'redirect'; readonly location: string }
  | ({ readonly kind: 'ready' } & Ready)
  | {
      readonly kind: 'unavailable';
      /** The status the page answers with. */
      readonly status: number;
      /** A stated wait of the failed read (429, 503, 504), in whole seconds; null when none is believed. */
      readonly retryAfter: string | null;
      readonly copy: string;
    };

const RETRY_AFTER = /^[1-9]\d{0,4}$/u;
const NEW_PATH = '/app/cms-content-modeling/templates/new';

const signIn = (returnTo: string) => ({
  kind: 'redirect' as const,
  location: `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
});

const retryAfterOf = (failure: Response): string | null => {
  const stated = failure.headers.get('retry-after');
  return (failure.status === 429 ||
    failure.status === 503 ||
    failure.status === 504) &&
    stated !== null &&
    RETRY_AFTER.test(stated)
    ? stated
    : null;
};

const unavailable = (failure: Response, copy: string) => ({
  kind: 'unavailable' as const,
  status: failure.ok ? 502 : failure.status,
  retryAfter: retryAfterOf(failure),
  copy,
});

const createCopy = (status: number): string =>
  status === 403
    ? 'Template designer access is required for the current acting context.'
    : status === 429
      ? 'Template choices are temporarily rate-limited. Wait and reload.'
      : 'Template choices are unavailable. Reload when the service is ready.';

const jsonOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

/** `templates/new`: the context read decides everything. */
export const templateCreatePageOutcome = async (
  selector: Response,
): Promise<
  TemplatePageOutcome<{ readonly context: TemplateDesignerContext }>
> => {
  if (selector.status === 401) return signIn(NEW_PATH);
  if (selector.ok) {
    const parsed = TemplateDesignerContextSchema.safeParse(
      await jsonOf(selector),
    );
    if (parsed.success) return { kind: 'ready', context: parsed.data };
  }
  return unavailable(selector, createCopy(selector.status));
};

/**
 * `templates/:templateKey`: both reads must be verified, the detail must be this key's own latest version and carry
 * its strong ETag. `templateKey` is null for a malformed or reserved key, whose reads are the 400 answers the page made
 * itself (no protected read).
 */
export const templateSuccessorPageOutcome = async (
  templateKey: string | null,
  selector: Response,
  latest: Response,
): Promise<
  TemplatePageOutcome<{
    readonly context: TemplateDesignerContext;
    readonly detail: TemplateVersionDetail;
  }>
> => {
  if (selector.status === 401 || latest.status === 401)
    return signIn(`/app/cms-content-modeling/templates/${templateKey}`);
  if (selector.ok && latest.ok) {
    const [selectorBody, latestBody] = await Promise.all([
      jsonOf(selector),
      jsonOf(latest),
    ]);
    const context = TemplateDesignerContextSchema.safeParse(selectorBody);
    const detail = TemplateVersionDetailSchema.safeParse(latestBody);
    if (
      context.success &&
      detail.success &&
      detail.data.templateKey === templateKey &&
      detail.data.version === String(detail.data.templateVersion) &&
      latest.headers.get('etag') === `"${detail.data.version}"`
    )
      return { kind: 'ready', context: context.data, detail: detail.data };
  }
  const failure = latest.ok ? selector : latest;
  return unavailable(
    failure,
    cmsTemplateUnavailableCopy(templateKey, failure.status),
  );
};

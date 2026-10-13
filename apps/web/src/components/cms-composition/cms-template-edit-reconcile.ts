import type { TemplateVersionDetail } from '@wejammin/contracts';

import {
  loadCmsValidators,
  loadedCmsValidators,
  type CmsValidators,
} from '../../lib/cms-contract-validators';

export type CmsTemplateLatestResult =
  | { readonly kind: 'loaded'; readonly detail: TemplateVersionDetail }
  | { readonly kind: 'rejected'; readonly status: 401 | 403 | 404 | 429 }
  | { readonly kind: 'unavailable' };

/** Recheck the authoritative preimage without carrying mutation authority. */
export const readLatestCmsTemplateVersion = async (
  templateKey: string,
  fetcher: typeof fetch = fetch,
): Promise<CmsTemplateLatestResult> => {
  // The schemas load on this first read; if they cannot be fetched the latest
  // version is unverifiable, exactly like an unreachable service.
  let validators: CmsValidators;
  try {
    validators = loadedCmsValidators() ?? (await loadCmsValidators());
  } catch {
    return { kind: 'unavailable' };
  }
  const key = validators.CmsTemplateKeySchema.safeParse(templateKey);
  if (!key.success) return { kind: 'unavailable' };
  let response: Response;
  try {
    response = await fetcher(`/api/v1/cms/templates/${key.data}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    return { kind: 'unavailable' };
  }
  if (!(response instanceof Response)) return { kind: 'unavailable' };
  if ([401, 403, 404, 429].includes(response.status))
    return {
      kind: 'rejected',
      status: response.status as 401 | 403 | 404 | 429,
    };
  if (response.status !== 200) return { kind: 'unavailable' };
  let candidate: unknown;
  try {
    candidate = await response.json();
  } catch {
    return { kind: 'unavailable' };
  }
  const detail = validators.TemplateVersionDetailSchema.safeParse(candidate);
  if (
    !detail.success ||
    detail.data.templateKey !== key.data ||
    detail.data.version !== String(detail.data.templateVersion) ||
    response.headers.get('etag') !== `"${detail.data.version}"`
  )
    return { kind: 'unavailable' };
  return { kind: 'loaded', detail: detail.data };
};

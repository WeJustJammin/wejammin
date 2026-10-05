import {
  CmsTemplateKeySchema,
  TemplateVersionDetailSchema,
  type TemplateVersionDetail,
} from '@wejammin/contracts';

export type CmsTemplateLatestResult =
  | { readonly kind: 'loaded'; readonly detail: TemplateVersionDetail }
  | { readonly kind: 'rejected'; readonly status: 401 | 403 | 404 | 429 }
  | { readonly kind: 'unavailable' };

/** Recheck the authoritative preimage without carrying mutation authority. */
export const readLatestCmsTemplateVersion = async (
  templateKey: string,
  fetcher: typeof fetch = fetch,
): Promise<CmsTemplateLatestResult> => {
  const key = CmsTemplateKeySchema.safeParse(templateKey);
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
  const detail = TemplateVersionDetailSchema.safeParse(candidate);
  if (
    !detail.success ||
    detail.data.templateKey !== key.data ||
    detail.data.version !== String(detail.data.templateVersion) ||
    response.headers.get('etag') !== `"${detail.data.version}"`
  )
    return { kind: 'unavailable' };
  return { kind: 'loaded', detail: detail.data };
};

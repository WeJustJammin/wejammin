import {
  CmsTemplateKeySchema,
  TemplateVersionDetailSchema,
} from '@wejammin/contracts';

import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';
import {
  forwardedError,
  localError,
} from './cms-composition-platform-mutation';

/** Same-origin projection; the API Worker and private RPC recheck authority. */
export const readCmsTemplateDetail = async (
  request: Request,
  binding: unknown,
  templateKey: string | undefined,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding)) return localError(request, 503);
  if (request.method !== 'GET' || new URL(request.url).search !== '')
    return localError(request, 400);
  const parsedKey = CmsTemplateKeySchema.safeParse(templateKey);
  if (!parsedKey.success) return localError(request, 400);
  if (!cmsEditorialSameOriginRequest(request)) return localError(request, 403);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/templates/${parsedKey.data}`,
        { method: 'GET', headers: cmsEditorialForwardHeaders(request) },
      ),
    );
  } catch {
    return localError(request, 503);
  }
  if (!(upstream instanceof Response)) return localError(request, 503);
  if (!upstream.ok) return forwardedError(request, upstream);
  if (upstream.status !== 200) return localError(request, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return localError(request, 502);
  const parsed = TemplateVersionDetailSchema.safeParse(body.value);
  if (
    !parsed.success ||
    parsed.data.templateKey !== parsedKey.data ||
    parsed.data.version !== String(parsed.data.templateVersion) ||
    upstream.headers.get('etag') !== `"${parsed.data.version}"`
  )
    return localError(request, 502);
  const headers = cmsEditorialCopyResponseHeaders(upstream);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(parsed.data), { status: 200, headers });
};

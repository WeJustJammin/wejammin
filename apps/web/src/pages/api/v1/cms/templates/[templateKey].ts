import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsTemplateDetail } from '../../../../../server/cms-composition-platform-detail';

export const prerender = false;

export const GET: APIRoute = ({ request, params }) =>
  readCmsTemplateDetail(request, env.PLATFORM_API, params.templateKey);

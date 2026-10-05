import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsTemplateContext } from '../../../../../server/cms-composition-platform-context';

export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  readCmsTemplateContext(request, env.PLATFORM_API);

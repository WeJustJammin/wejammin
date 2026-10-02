import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardAuthRequest } from '../../../../../../server/auth-platform-api.ts';

export const prerender = false;

/** AUTH-API-20: create a step-up challenge for the verified session. */
export const POST: APIRoute = ({ request }) =>
  forwardAuthRequest(
    request,
    env.PLATFORM_API,
    '/api/v1/auth/step-up/challenges',
    'POST',
  );

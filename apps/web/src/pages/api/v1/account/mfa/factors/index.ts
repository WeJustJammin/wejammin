import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardAuthRequest } from '../../../../../../server/auth-platform-api.ts';

export const prerender = false;

const PATH = '/api/v1/account/mfa/factors';

/** AUTH-API-16: the caller's own MFA factor list. */
export const GET: APIRoute = ({ request }) =>
  forwardAuthRequest(request, env.PLATFORM_API, PATH, 'GET');

/** AUTH-API-17: start TOTP enrollment (one-time secret, never stored here). */
export const POST: APIRoute = ({ request }) =>
  forwardAuthRequest(request, env.PLATFORM_API, PATH, 'POST');

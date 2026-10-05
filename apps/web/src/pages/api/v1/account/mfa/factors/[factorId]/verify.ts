import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardAuthRequest } from '../../../../../../../server/auth-platform-api.ts';

export const prerender = false;

/** AUTH-API-18: verify the first TOTP code of a pending factor. */
export const POST: APIRoute = ({ request, params }) =>
  forwardAuthRequest(
    request,
    env.PLATFORM_API,
    `/api/v1/account/mfa/factors/${encodeURIComponent(params.factorId ?? '')}/verify`,
    'POST',
  );

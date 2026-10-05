import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardAuthRequest } from '../../../../../../server/auth-platform-api.ts';

export const prerender = false;

/** AUTH-API-19: remove or cancel a factor; the factor id is an opaque path value. */
export const DELETE: APIRoute = ({ request, params }) =>
  forwardAuthRequest(
    request,
    env.PLATFORM_API,
    `/api/v1/account/mfa/factors/${encodeURIComponent(params.factorId ?? '')}`,
    'DELETE',
  );

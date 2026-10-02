import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardAuthRequest } from '../../../../../../../server/auth-platform-api.ts';

export const prerender = false;

/** AUTH-API-21: verify a challenge; the Worker rotates the session cookies. */
export const POST: APIRoute = ({ request, params }) =>
  forwardAuthRequest(
    request,
    env.PLATFORM_API,
    `/api/v1/auth/step-up/challenges/${encodeURIComponent(params.challengeId ?? '')}/verify`,
    'POST',
  );

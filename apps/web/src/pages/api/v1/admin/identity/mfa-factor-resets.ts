import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardAuthRequest } from '../../../../../server/auth-platform-api.ts';

export const prerender = false;

/**
 * CFG-05B-06: administrative reset of another person's MFA factors. The
 * Worker owns capability, step-up, reason and audit; this route only relays
 * the first-party same-origin request.
 */
export const POST: APIRoute = ({ request }) =>
  forwardAuthRequest(
    request,
    env.PLATFORM_API,
    '/api/v1/admin/identity/mfa-factor-resets',
    'POST',
  );

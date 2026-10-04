import {
  AuthorizationStartSchema,
  EmailStartRequestSchema,
  OAuthStartRequestSchema,
} from '@wejammin/contracts';
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import {
  copyAuthCookies,
  forwardAuthRequest,
} from '../../server/auth-platform-api.ts';
import { publicStartHeaders } from '../../server/auth-public-start.ts';

export const prerender = false;

const redirect = (location: string, source?: Response): Response => {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  if (source !== undefined) copyAuthCookies(source, headers);
  return new Response(null, { status: 303, headers });
};

/** A sign-in start form is a handful of short fields; anything larger is refused unread. */
const MAX_START_FORM_BYTES = 8192;

const declaredBytes = (request: Request): number =>
  Number(request.headers.get('content-length') ?? 0);

export const POST: APIRoute = async ({ request }) => {
  // BE00 step 2 ahead of the body: a cross-origin post, or one that declares
  // more than the form can hold, is refused without being parsed.
  const origin = request.headers.get('origin');
  if (
    (origin !== null && origin !== new URL(request.url).origin) ||
    !(declaredBytes(request) <= MAX_START_FORM_BYTES)
  )
    return redirect('/auth/sign-in?outcome=invalid');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect('/auth/sign-in?outcome=invalid');
  }
  const returnTo = form.get('returnTo');
  const intent = form.get('intent');
  const provider = form.get('provider');
  const email = form.get('email');
  const isEmail = typeof email === 'string' && email !== '';
  const parsed = isEmail
    ? EmailStartRequestSchema.safeParse({ email, intent, returnTo })
    : OAuthStartRequestSchema.safeParse({ provider, intent, returnTo });
  if (!parsed.success) return redirect('/auth/sign-in?outcome=invalid');

  const targetPath = isEmail
    ? '/api/v1/auth/email/start'
    : '/api/v1/auth/oauth/start';
  const headers = publicStartHeaders(request.headers, intent);
  const upstream = await forwardAuthRequest(
    new Request(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(parsed.data),
    }),
    env.PLATFORM_API,
    targetPath,
    'POST',
  );
  if (upstream.status < 200 || upstream.status >= 300) {
    return redirect('/auth/sign-in?outcome=unavailable');
  }
  if (isEmail) return redirect('/auth/sign-in?outcome=email_sent', upstream);
  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return redirect('/auth/sign-in?outcome=unavailable');
  }
  const authorization = AuthorizationStartSchema.safeParse(body);
  return authorization.success
    ? redirect(authorization.data.authorizationUrl, upstream)
    : redirect('/auth/sign-in?outcome=unavailable');
};

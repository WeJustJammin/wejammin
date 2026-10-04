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

export const POST: APIRoute = async ({ request }) => {
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

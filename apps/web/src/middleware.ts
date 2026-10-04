import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

import {
  createHttpsRedirectResponse,
  generateRequestNonce,
  shouldRedirectToHttps,
  withSecurityHeaders,
} from './security-headers';
import { withStepUpScope } from './server/step-up-scope';

export const onRequest = defineMiddleware(async (context, next) => {
  const nonce = generateRequestNonce();
  context.locals.cspNonce = nonce;

  if (shouldRedirectToHttps(context.request)) {
    return withSecurityHeaders(
      createHttpsRedirectResponse(context.request),
      nonce,
    );
  }

  // Review r14: bind tab-held step-up drafts to the signed-in subject through a
  // random nonce; the HMAC key is the web Worker secret STEP_UP_SCOPE_SECRET
  // (absent means the edge fails closed: no draft survives a page load).
  const scopeSecret = (env as unknown as { STEP_UP_SCOPE_SECRET?: unknown })
    .STEP_UP_SCOPE_SECRET;
  return withStepUpScope(
    context.request,
    await withSecurityHeaders(await next(), nonce),
    typeof scopeSecret === 'string' ? scopeSecret : null,
  );
});

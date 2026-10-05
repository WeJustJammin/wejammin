import { defineMiddleware } from 'astro:middleware';

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
  // random nonce and an HttpOnly unkeyed subject digest (no secret).
  return withStepUpScope(
    context.request,
    await withSecurityHeaders(await next(), nonce),
  );
});

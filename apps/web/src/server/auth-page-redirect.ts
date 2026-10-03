/**
 * The sign-in redirect of a protected auth page (FE01 `/step-up`,
 * `/settings/security/mfa`): status 303, an exact `Location`, never cached.
 * The Astro pages return this response instead of calling `Astro.redirect`, so
 * the status and header are executable behavior that tests can observe.
 */
export const authPageRedirect = (location: string): Response =>
  new Response(null, {
    status: 303,
    headers: { location, 'cache-control': 'no-store' },
  });

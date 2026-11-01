/**
 * Browser-side helpers of the Slice 11 real-route specs: a context signed in
 * with the Slice 11 session claims (capabilities, acting person, optional
 * step-up instant) and the completion of a step-up ceremony.
 */
import type { Browser, BrowserContext } from '@playwright/test';

import { authenticateLocalSession } from './local-signed-session';
import { createClient } from './s10-real-api';
import { collectBrowserErrors, type SignedIn } from './s10-real-browser';
import type { S10Principal, S10World } from './s10-real-world';
import { s11Session } from './s11-real-world';

export type S11Actor = Readonly<{
  principal: S10Principal;
  capabilities: readonly string[];
}>;

/** A new context signed in as `actor`; `stepUpAt` null means no completed MFA. */
export const signInS11 = async (
  browser: Browser,
  world: S10World,
  actor: S11Actor,
  stepUpAt: Date | null,
): Promise<SignedIn> => {
  const context = await browser.newContext();
  await authenticateLocalSession(
    context,
    s11Session(world, actor.principal, actor.capabilities, stepUpAt),
  );
  const page = await context.newPage();
  const browserErrors: string[] = [];
  collectBrowserErrors(page, browserErrors);
  return {
    context,
    page,
    client: createClient(context, world, actor.principal, 1),
    browserErrors,
  };
};

/**
 * Complete the step-up ceremony for the context's session: the signed session
 * states the instant the MFA ceremony finished, as the authentication
 * projection does for a real session (the ceremony itself is the Slice 09
 * suites' subject).
 */
export const completeStepUp = async (
  context: BrowserContext,
  world: S10World,
  actor: S11Actor,
): Promise<void> => {
  await authenticateLocalSession(
    context,
    s11Session(world, actor.principal, actor.capabilities, new Date()),
  );
};

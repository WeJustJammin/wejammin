import { parseServerEnvironment } from '@wejammin/config/environment';
import { describe, expect, it, vi } from 'vitest';

import { createProductionAuthenticationDependencies } from '../authentication/production';

import {
  bindings,
  createApp,
  createAuth,
  resource,
  session,
  success,
} from '../authentication/phase-02-slice-01.test-support';

/**
 * FE03 1129: the template picker context "does not extend the general auth-session resource or
 * grant designer authority in the browser". Through the real Worker route, a caller who holds
 * `cms.template_designer` reads the same six-member session resource as anyone else, and a
 * reader that tried to widen it with CMS authority is never served.
 */
const DESIGNER_SESSION = {
  ...session,
  capabilities: ['cms.template_designer'],
} as const;
const read = (app: ReturnType<typeof createApp>['app']) =>
  app.request(
    'https://api.example.test/api/v1/auth/session',
    {
      headers: {
        origin: 'https://api.example.test',
        cookie: 'wj_session_ref=slice01-session-ref',
      },
    },
    bindings,
  );

describe('GET /api/v1/auth/session beside the CMS-11 picker context', () => {
  it('[P2-S12-AC-164] renders a designer-capable session through the production session reader as exactly the six authentication members and no capability', async () => {
    // The route builds its body from `readSession(resolvedSession)`: the real production reader is
    // used, so the capability-carrying session on `resolveSession` is what the body is derived from.
    const production = createProductionAuthenticationDependencies({
      environment: parseServerEnvironment(bindings),
    });
    const readSession = vi.fn(production.readSession);
    const { app } = createApp(
      createAuth({
        resolveSession: vi.fn(async () => success(DESIGNER_SESSION)),
        readSession,
      }),
    );
    const response = await read(app);
    expect(response.status).toBe(200);
    expect(readSession).toHaveBeenCalledTimes(1);
    expect(readSession.mock.calls[0]?.[0]).toMatchObject({
      capabilities: ['cms.template_designer'],
    });
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      authenticated: true,
      accountState: session.accountState,
      bootstrapState: 'complete',
      personId: session.personId,
      actingPartyId: session.actingPartyId,
      sessionExpiresAt: session.expiresAt,
    });
    expect(Object.keys(body).sort()).toEqual(Object.keys(resource).sort());
  });

  it('[P2-S12-AC-164] never serves a session reader that widens the resource with designer authority', async () => {
    const { app } = createApp(
      createAuth({
        readSession: vi.fn(async () =>
          success({
            ...resource,
            capabilities: ['cms.template_designer'],
          } as typeof resource),
        ),
      }),
    );
    const response = await read(app);
    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toMatch(/cms\.template_designer/u);
  });
});

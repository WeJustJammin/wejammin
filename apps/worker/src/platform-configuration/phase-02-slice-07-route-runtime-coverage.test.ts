import { describe, expect, it, vi } from 'vitest';

import type { ConfigurationPort } from './types';
import {
  action,
  actionRequest,
  definitionRequest,
  effectiveRequest,
  expectError,
  jsonRequest,
  makeHarness,
  proposal,
  proposalRequest,
  proposalResponse,
  releaseRequest,
  request,
  serviceEffectiveRequest,
  serviceHeaders,
} from './phase-02-slice-07.test-support';

describe('Slice 07 route runtime defensive branches', () => {
  it('rejects foreign origins before register, effective, and action handlers', async () => {
    const cases = [
      () =>
        releaseRequest(definitionRequest, { origin: 'https://evil.example' }),
      () => effectiveRequest(undefined, { origin: 'https://evil.example' }),
      () => actionRequest(action, { origin: 'https://evil.example' }),
    ];

    for (const makeRequest of cases) {
      const harness = makeHarness();
      const response = await harness.app.request(makeRequest());

      await expectError(
        response,
        403,
        'FORBIDDEN',
        'The request origin is not allowed.',
      );
      expect(harness.port).not.toHaveBeenCalled();
    }
  });

  it('rejects an effective query the strict schema refuses with its violations', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      request(
        '/api/v1/config/profile.visibility/effective?consumerKey=web.profile&supportedDefinitionVersions=not-a-number',
        { headers: { authorization: 'Bearer verified-session' } },
      ),
    );
    await expectError(
      response,
      400,
      'INVALID_REQUEST',
      'The query parameters are invalid.',
      { violations: expect.any(Array) },
    );
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('rejects invalid effective, proposal, and action route parameters', async () => {
    const effectiveHarness = makeHarness();
    const effective = await effectiveHarness.app.request(
      request(
        '/api/v1/config/Bad.Key/effective?consumerKey=web.profile&supportedDefinitionVersions=1',
        { headers: { authorization: 'Bearer verified-session' } },
      ),
    );
    await expectError(
      effective,
      400,
      'INVALID_REQUEST',
      'The path parameters are invalid.',
      { violations: expect.any(Array) },
    );

    const proposalHarness = makeHarness();
    const invalidProposal = await proposalHarness.app.request(
      jsonRequest(
        'POST',
        '/api/v1/admin/settings/not-a-uuid/changes',
        proposal,
        {
          authorization: 'Bearer verified-session',
          'idempotency-key': 'bad-proposal-path',
        },
      ),
    );
    await expectError(
      invalidProposal,
      400,
      'INVALID_REQUEST',
      'The path parameters are invalid.',
      { violations: expect.any(Array) },
    );

    const actionHarness = makeHarness();
    const invalidAction = await actionHarness.app.request(
      jsonRequest(
        'POST',
        '/api/v1/admin/settings/changes/not-a-uuid/actions',
        action,
        {
          authorization: 'Bearer verified-session',
          'idempotency-key': 'bad-action-path',
        },
      ),
    );
    await expectError(
      invalidAction,
      400,
      'INVALID_REQUEST',
      'The path parameters are invalid.',
      { violations: expect.any(Array) },
    );
  });

  it('binds a verified If-Match version before the proposal port', async () => {
    let received: Parameters<ConfigurationPort>[0] | undefined;
    const port = vi.fn<ConfigurationPort>(async (input) => {
      received = input;
      return { ok: true, value: proposalResponse };
    });
    const harness = makeHarness({ port });

    const response = await harness.app.request(
      proposalRequest(proposal, { 'if-match': '"1"' }),
    );

    expect(response.status).toBe(201);
    expect(received?.ifMatch).toBe('1');
  });

  it('rejects a service query whose consumer key differs from the verified consumer', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      request(
        '/api/v1/config/profile.visibility/effective?consumerKey=old.client&supportedDefinitionVersions=1',
        { headers: serviceHeaders },
      ),
    );

    await expectError(
      response,
      403,
      'FORBIDDEN',
      'The service consumer is not allowed for this key.',
    );
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('returns a typed rate-limit response for a denied verified service consumer', async () => {
    const harness = makeHarness({
      rateLimit: {
        ok: true,
        value: {
          allowed: false,
          limit: 10,
          remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + 30,
        },
      },
    });

    const response = await harness.app.request(serviceEffectiveRequest());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'RATE_LIMITED' }),
    );
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('rejects a cookie-authenticated action with an invalid CSRF token', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      actionRequest(action, {
        cookie: 'wj_session_ref=session; wj_csrf=opaque-token',
        'x-csrf-token': 'wrong-token',
      }),
    );

    await expectError(response, 403, 'FORBIDDEN', 'The CSRF token is invalid.');
    expect(harness.port).not.toHaveBeenCalled();
  });
});

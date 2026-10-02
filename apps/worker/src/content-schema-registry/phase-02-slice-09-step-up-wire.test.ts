import { describe, expect, it, vi } from 'vitest';

import { errorResponse } from './route-response';
import type { FeatureContext } from './route-types';
import type { ContentSchemaRegistryError } from './types';

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const responseContext = () => {
  const headers = new Map<string, string>();
  const context = {
    header: vi.fn((name: string, value: string) => headers.set(name, value)),
    json: vi.fn(
      (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  } as unknown as FeatureContext;
  return { context, headers };
};

const failure = (
  status: ContentSchemaRegistryError['status'],
  code: string,
  details?: Readonly<Record<string, unknown>>,
): ContentSchemaRegistryError => ({
  ok: false,
  status,
  code,
  message: 'Recent verification is required.',
  ...(details === undefined ? {} : { details }),
});

const wire = async (result: ContentSchemaRegistryError) => {
  const { context, headers } = responseContext();
  const response = errorResponse(context, result, REQUEST_ID);
  const body = (await response.json()) as Readonly<{
    code: string;
    message: string;
    requestId: string;
    details: Readonly<Record<string, unknown>>;
  }>;
  return { body, headers, response };
};

describe('BE00 step-up disclosure at the HTTP error boundary', () => {
  it('emits the BE00 step-up details with the server-owned method list', async () => {
    const { body, headers, response } = await wire(
      failure(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );

    expect(response.status).toBe(401);
    expect(headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      requestId: REQUEST_ID,
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });

  it('emits the unconfigured empty allowlist without inventing methods', async () => {
    const { body } = await wire(
      failure(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: [],
      }),
    );

    expect(body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: [],
    });
    expect(JSON.stringify(body)).not.toContain('totp');
  });

  it('excludes injected and private step-up details from the wire body', async () => {
    const { body } = await wire(
      failure(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
        internalReason: 'provider_mfa_lookup_failed',
        factorId: 'private-factor-id',
        provider: 'supabase',
        providerUrl: 'https://private-project.supabase.co',
      }),
    );

    expect(body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('provider_mfa_lookup_failed');
    expect(serialized).not.toContain('private-factor-id');
    expect(serialized).not.toContain('supabase.co');
  });

  it('bounds advertised methods to safe identifiers, deduplicated and capped', async () => {
    const { body } = await wire(
      failure(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: [
          'totp',
          'totp',
          'webauthn',
          'Not A Method',
          '',
          'TOTP',
          42,
          null,
          { method: 'totp' },
          ['totp'],
          'a'.repeat(33),
          'method/../escalation',
          'mfa_service',
          'm0',
          'm1',
          'm2',
          'm3',
          'm4',
          'm5',
          'm6',
          'm7',
          'm8',
        ],
      }),
    );

    expect(body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: [
        'totp',
        'webauthn',
        'mfa_service',
        'm0',
        'm1',
        'm2',
        'm3',
        'm4',
      ],
    });
  });

  it('fails closed when step-up details do not match the code contract', async () => {
    const wrongRecovery = await wire(
      failure(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'reauthenticate',
        allowedMethods: ['totp'],
      }),
    );
    expect(wrongRecovery.body.details).toEqual({});

    const injectedRecovery = await wire(
      failure(401, 'UNAUTHENTICATED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(injectedRecovery.body.details).toEqual({});
  });

  it('fails closed when step-up details are malformed', async () => {
    const malformedDetails: Readonly<Record<string, unknown>>[] = [
      { recoveryAction: 'step_up' },
      { recoveryAction: 'step_up', allowedMethods: 'totp' },
      { recoveryAction: 'step_up', allowedMethods: null },
      { recoveryAction: 'step_up', allowedMethods: { 0: 'totp' } },
      { allowedMethods: ['totp'] },
      {},
    ];

    for (const details of malformedDetails) {
      const { body } = await wire(failure(401, 'STEP_UP_REQUIRED', details));
      expect(body.details, JSON.stringify(details)).toEqual({});
    }

    const { body } = await wire(failure(401, 'STEP_UP_REQUIRED'));
    expect(body.details).toEqual({});
  });

  it('preserves the existing unauthenticated reauthenticate disclosure', async () => {
    const unauthenticated = await wire(
      failure(401, 'UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
    );
    expect(unauthenticated.body.details).toEqual({
      recoveryAction: 'reauthenticate',
    });

    const empty = await wire(failure(401, 'UNAUTHENTICATED', {}));
    expect(empty.body.details).toEqual({});

    const otherCode = await wire(
      failure(401, 'WEBHOOK_REJECTED', { recoveryAction: 'reauthenticate' }),
    );
    expect(otherCode.body.details).toEqual({
      recoveryAction: 'reauthenticate',
    });

    const injectedStepUp = await wire(
      failure(401, 'WEBHOOK_REJECTED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(injectedStepUp.body.details).toEqual({});
  });
});

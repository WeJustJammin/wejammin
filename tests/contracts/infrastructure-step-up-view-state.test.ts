import { InfrastructureViewStateSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

/**
 * FE00 error-per-class mapping (DEC-111): a 401 STEP_UP_REQUIRED is a recovery
 * that navigates to `/step-up?returnTo=<current relative path>`. It is never a
 * 403 capability gate, so the infrastructure view-state union carries it as its
 * own `step_up_required` status and `capability_gate` only models the
 * `request_capability` recovery.
 */
const RETURN_TO = '/app/infrastructure?tab=facts&selected=abc';

describe('FE00 infrastructure view state step-up recovery', () => {
  it('[P2-S09-AC-1127] refuses a capability gate that carries the step_up recovery', () => {
    expect(
      InfrastructureViewStateSchema.safeParse({
        status: 'capability_gate',
        recovery: 'step_up',
        requiredCapability: 'infrastructure.write',
      }).success,
    ).toBe(false);
    expect(
      InfrastructureViewStateSchema.safeParse({
        status: 'capability_gate',
        recovery: 'request_capability',
        requiredCapability: 'infrastructure.write',
      }).success,
    ).toBe(true);
  });

  it('[P2-S09-AC-1127] models STEP_UP_REQUIRED as its own step_up_required status with a safe returnTo and the typed allowedMethods', () => {
    const parsed = InfrastructureViewStateSchema.parse({
      status: 'step_up_required',
      returnTo: RETURN_TO,
      allowedMethods: ['totp'],
    });
    expect(parsed).toEqual({
      status: 'step_up_required',
      returnTo: RETURN_TO,
      allowedMethods: ['totp'],
    });
  });

  it.each([
    ['an absolute URL', { returnTo: 'https://evil.example/app' }],
    ['a protocol-relative URL', { returnTo: '//evil.example/app' }],
    ['a non-allowlisted route', { returnTo: '/public/home' }],
    ['a missing allowedMethods list', { allowedMethods: undefined }],
    ['a non-array allowedMethods', { allowedMethods: 'totp' }],
    ['more than eight methods', { allowedMethods: Array(9).fill('totp') }],
    ['an empty method id', { allowedMethods: [''] }],
    ['an unknown extra key', { requiredCapability: 'infrastructure.write' }],
  ])('[P2-S09-AC-1127] rejects step_up_required with %s', (_label, patch) => {
    expect(
      InfrastructureViewStateSchema.safeParse({
        status: 'step_up_required',
        returnTo: RETURN_TO,
        allowedMethods: ['totp'],
        ...patch,
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-1127] allows an empty allowedMethods list like the BE00 STEP_UP_REQUIRED detail', () => {
    expect(
      InfrastructureViewStateSchema.safeParse({
        status: 'step_up_required',
        returnTo: '/app',
        allowedMethods: [],
      }).success,
    ).toBe(true);
  });

  it('[P2-S09-AC-1127] presents step_up_required as a /step-up?returnTo= navigation and never as a gate or reauthentication', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    const presentation = presentInfrastructureState(
      InfrastructureViewStateSchema.parse({
        status: 'step_up_required',
        returnTo: RETURN_TO,
        allowedMethods: ['totp'],
      }),
    );
    expect(presentation).toMatchObject({
      status: 'step_up_required',
      recoveryHref: `/step-up?returnTo=${encodeURIComponent(RETURN_TO)}`,
      allowedMethods: ['totp'],
      gateRendered: false,
    });
    expect(presentation).not.toHaveProperty('requiredCapability');
    expect(presentation).not.toHaveProperty('protectedLabelsVisible');
    expect(presentation.status).not.toBe('capability_gate');
    expect(presentation.status).not.toBe('unauthenticated');
  });

  it('[P2-S09-AC-1127] keeps 403 as a capability gate and 401 UNAUTHENTICATED as reauthentication in the presenter', async () => {
    const { presentInfrastructureState } =
      await import('../../packages/ui/src/infrastructure/presentation.ts');
    expect(
      presentInfrastructureState(
        InfrastructureViewStateSchema.parse({
          status: 'capability_gate',
          recovery: 'request_capability',
          requiredCapability: 'infrastructure.read',
        }),
      ),
    ).toMatchObject({
      status: 'capability_gate',
      recovery: 'request_capability',
      protectedLabelsVisible: false,
    });
    expect(
      presentInfrastructureState(
        InfrastructureViewStateSchema.parse({
          status: 'unauthenticated',
          returnTo: '/app/infrastructure',
        }),
      ),
    ).toEqual({ status: 'unauthenticated', returnTo: '/app/infrastructure' });
  });
});

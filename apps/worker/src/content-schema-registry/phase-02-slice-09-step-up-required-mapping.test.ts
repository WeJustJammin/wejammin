import { describe, expect, it } from 'vitest';

import { createContentSchemaRegistryApp } from './index';
import {
  codeFromRpcError,
  knownFailure,
  mapRpcFailure,
} from './production-errors';
import {
  CMS_ORIGIN,
  TYPE_ID,
  VERSION_ID,
  activationBody,
  expectError,
  humanRequest,
  makeDependencies,
  ok,
} from './routes.coverage.fixtures';

const ACTIVATION_PATH = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/activate`;

describe('BE00 STEP_UP_REQUIRED mapping', () => {
  it('knows the code the CMS RPC raises for a missing recent step-up', () => {
    expect(knownFailure('STEP_UP_REQUIRED')).toMatchObject({
      status: 401,
      code: 'STEP_UP_REQUIRED',
    });
  });

  it('detects STEP_UP_REQUIRED in an RPC failure body', () => {
    expect(codeFromRpcError({ message: 'STEP_UP_REQUIRED' })).toBe(
      'STEP_UP_REQUIRED',
    );
  });

  it('maps a 401 RPC step-up failure to the exact BE00 code and details', () => {
    expect(mapRpcFailure(401, { message: 'STEP_UP_REQUIRED' })).toMatchObject({
      status: 401,
      code: 'STEP_UP_REQUIRED',
      details: { recoveryAction: 'step_up', allowedMethods: [] },
    });
  });

  it('never forwards an RPC-supplied step-up method allowlist', () => {
    const mapped = mapRpcFailure(401, {
      message: 'STEP_UP_REQUIRED',
      details: { allowedMethods: ['totp'], recoveryAction: 'step_up' },
    });

    expect(mapped).toMatchObject({ code: 'STEP_UP_REQUIRED' });
    if (mapped.ok) return;
    expect(mapped.details?.allowedMethods).toEqual([]);
  });

  it('keeps an ordinary 401 authentication failure unchanged', () => {
    expect(mapRpcFailure(401, { message: 'UNAUTHENTICATED' })).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
  });
});

describe('CMS-03A-04 step-up refusal disclosure', () => {
  const activateWithoutStepUp = async () => {
    const { dependencies, ports } = makeDependencies({
      session: ok({
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: '20000000-0000-4000-8000-000000000002',
        capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
        mfaFresh: false,
      }),
    });
    const response = await createContentSchemaRegistryApp(dependencies).request(
      humanRequest(ACTIVATION_PATH, activationBody, { 'if-match': '"1"' }),
    );
    return { response, ports };
  };

  it('refuses activation with 401 STEP_UP_REQUIRED and never mutates', async () => {
    const { response, ports } = await activateWithoutStepUp();
    const body = await expectError(response, 401);

    expect(body.code).toBe('STEP_UP_REQUIRED');
    expect(ports['activateSchema']).not.toHaveBeenCalled();
  });

  it('never tells the caller to reauthenticate instead of stepping up', async () => {
    const { response } = await activateWithoutStepUp();
    const body = await expectError(response, 401);
    const details = (body.details ?? {}) as Readonly<Record<string, unknown>>;

    expect(details['recoveryAction']).not.toBe('reauthenticate');
  });

  it('still asks for reauthentication when the session itself is invalid', async () => {
    const { dependencies } = makeDependencies({
      session: ok({
        userId: 'not-a-uuid',
        actingPartyId: null,
        capabilities: ['cms.schema_designer'],
        mfaFresh: true,
      }),
    });
    const response = await createContentSchemaRegistryApp(dependencies).request(
      humanRequest(ACTIVATION_PATH, activationBody, { 'if-match': '"1"' }),
    );
    const body = await expectError(response, 401);

    expect(body.code).toBe('UNAUTHENTICATED');
    expect(body.details).toMatchObject({ recoveryAction: 'reauthenticate' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(`${body.code} ${JSON.stringify(body.details)}`).not.toContain(
      CMS_ORIGIN,
    );
  });
});

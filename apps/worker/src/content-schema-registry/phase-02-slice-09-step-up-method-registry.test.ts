import { describe, expect, it } from 'vitest';

import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import { createContentSchemaRegistryApp } from './index';
import { CMS_STEP_UP_ALLOWED_METHODS, knownFailure } from './production-errors';
import {
  TYPE_ID,
  VERSION_ID,
  activationBody,
  expectError,
  humanRequest,
  makeDependencies,
  ok,
} from './routes.coverage.fixtures';

const ACTIVATION_PATH = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/activate`;

describe('CMS STEP_UP_REQUIRED method registry (BE00 recovery routing)', () => {
  it('[P2-S09-AC-909] derives the CMS allowlist from the one configured step-up method registry', () => {
    expect(CMS_STEP_UP_ALLOWED_METHODS).toEqual([...MFA_METHOD_REGISTRY]);
    expect(CMS_STEP_UP_ALLOWED_METHODS).toEqual(['totp']);
    expect(Object.isFrozen(CMS_STEP_UP_ALLOWED_METHODS)).toBe(true);
  });

  it('[P2-S09-AC-909] knownFailure advertises the registry methods with recoveryAction step_up', () => {
    expect(knownFailure('STEP_UP_REQUIRED')).toMatchObject({
      status: 401,
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });

  it('[P2-S09-AC-909] a stale-MFA CMS command answers 401 with the registry methods and no 403', async () => {
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
    const body = await expectError(response, 401);

    expect(body.code).toBe('STEP_UP_REQUIRED');
    expect(body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    expect(ports['activateSchema']).not.toHaveBeenCalled();
  });
});

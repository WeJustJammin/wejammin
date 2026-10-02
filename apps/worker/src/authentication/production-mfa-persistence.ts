import type { MfaPersistencePort } from './mfa-types';
import type { AuthProductionConfiguration } from './production-configuration';
import {
  createInvoker,
  MFA_PERSISTENCE_RPC,
} from './production-mfa-persistence-support';
import { createRegistryPersistence } from './production-mfa-registry-persistence';
import { createStepUpPersistence } from './production-step-up-persistence';

export { MFA_PERSISTENCE_RPC };

/**
 * Composes the protected `platform_api` RPCs behind `MfaPersistencePort`
 * (BE01a DEC-111): one identity transaction per method, never a direct table
 * read or write, and provider ids that never reach a browser.
 */
export const createMfaPersistence = (
  config: AuthProductionConfiguration,
): MfaPersistencePort => {
  const invoke = createInvoker(config);
  return {
    ...createRegistryPersistence(invoke),
    ...createStepUpPersistence(invoke),
  };
};

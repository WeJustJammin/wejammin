import { createEnrollmentService } from './mfa-service-enrollment';
import { createRemovalService } from './mfa-service-removal';
import type {
  MfaAuthenticationMethods,
  MfaServiceDependencies,
} from './mfa-types';
import { createStepUpService } from './step-up-service';

/**
 * DEC-111 use cases (AUTH-API-16..21) over typed ports. Routes own the HTTP
 * boundary; this service owns ordering, step-up and recency rules, and the
 * mapping of provider outcomes to local state.
 */
export const createMfaService = (
  dependencies: MfaServiceDependencies,
): Required<MfaAuthenticationMethods> => ({
  ...createEnrollmentService(dependencies),
  ...createRemovalService(dependencies),
  ...createStepUpService(dependencies),
});

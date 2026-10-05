import { createMfaService } from './mfa-service';
import { withMfaProviderTelemetry } from './mfa-telemetry';
import type { MfaAuthenticationMethods } from './mfa-types';
import type { AuthProductionConfiguration } from './production-configuration';
import { createSupabaseMfaProvider } from './production-mfa-provider';
import { createMfaPersistence } from './production-mfa-persistence';
import { createSessionRotation } from './production-session-rotation';

/**
 * Composes the DEC-111 use cases (AUTH-API-16..21) over the production ports:
 * Supabase Auth MFA for the provider effect, protected RPCs for registry and
 * challenge state, and the aal2 session rotation. `issuer` is the registered
 * label shown in the authenticator app.
 */
export const createMfaDependencies = (
  config: AuthProductionConfiguration,
  issuer: string,
): Required<MfaAuthenticationMethods> =>
  createMfaService({
    persistence: createMfaPersistence(config),
    provider: withMfaProviderTelemetry(
      createSupabaseMfaProvider(config, { issuer }),
      config.now,
    ),
    rotation: createSessionRotation(config),
    now: config.now,
  });

import type { AuthenticationError } from '../authentication/types';
import type {
  ConfigurationOutcome,
  ConfigurationPortInput,
  PlatformConfigurationOperationId,
} from './types';

export type ConfigurationPortName =
  | 'registerDefinition'
  | 'resolveEffectiveValue'
  | 'proposeChange'
  | 'changeAction';

const statuses: Readonly<
  Record<PlatformConfigurationOperationId, 200 | 201 | 202>
> = {
  'CFG-05A-01': 201,
  'CFG-05A-02': 200,
  'CFG-05A-03': 201,
  'CFG-05A-04': 200,
  'CFG-05B-01': 200,
  'CFG-05B-04': 201,
  'CFG-05B-05': 200,
  'CFG-05B-06': 200,
  'CFG-05B-07': 200,
};

const deadlines: Readonly<Record<PlatformConfigurationOperationId, number>> = {
  'CFG-05A-01': 15_000,
  'CFG-05A-02': 8_000,
  'CFG-05A-03': 15_000,
  'CFG-05A-04': 15_000,
  'CFG-05B-01': 8_000,
  'CFG-05B-04': 15_000,
  'CFG-05B-05': 8_000,
  'CFG-05B-06': 15_000,
  'CFG-05B-07': 8_000,
};

const rates: Readonly<
  Record<
    PlatformConfigurationOperationId,
    Readonly<{ limit: number; window: number }>
  >
> = {
  'CFG-05A-01': { limit: 30, window: 60 },
  'CFG-05A-02': { limit: 300, window: 60 },
  'CFG-05A-03': { limit: 60, window: 60 },
  'CFG-05A-04': { limit: 30, window: 60 },
  'CFG-05B-01': { limit: 120, window: 60 },
  'CFG-05B-04': { limit: 20, window: 60 },
  'CFG-05B-05': { limit: 120, window: 60 },
  // BE05b: 5 per hour per user; the party bucket lives in admin-mfa-reset-rate.ts.
  'CFG-05B-06': { limit: 5, window: 3600 },
  'CFG-05B-07': { limit: 120, window: 60 },
};

export const configurationStatus = (
  operationId: PlatformConfigurationOperationId,
): 200 | 201 | 202 => statuses[operationId];

export const configurationDeadline = (
  operationId: PlatformConfigurationOperationId,
): number => deadlines[operationId];

export const configurationRatePolicy = (
  operationId: PlatformConfigurationOperationId,
): Readonly<{ limit: number; window: number }> => rates[operationId];

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stable(child)]),
  );
};

export const configurationFingerprint = (
  input: ConfigurationPortInput,
): string =>
  JSON.stringify(
    stable({
      operationId: input.operationId,
      path: input.path ?? {},
      query: input.query ?? {},
      body: input.body ?? {},
      ifMatch: input.ifMatch ?? null,
      servicePrincipalId: input.servicePrincipalId ?? null,
      serviceConsumerKey: input.serviceConsumerKey ?? null,
    }),
  );

export const configurationReplayKey = (input: ConfigurationPortInput): string =>
  `${input.operationId}|${input.session?.authUserId ?? input.servicePrincipalId ?? 'anonymous'}|${input.idempotencyKey ?? ''}`;

export const configurationResponseVersion = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Readonly<Record<string, unknown>>;
  for (const key of [
    'version',
    'definitionVersion',
    'resultingVersion',
    'evaluatorVersion',
  ]) {
    const candidate = record[key];
    if (typeof candidate === 'string' && /^[1-9][0-9]{0,17}$/u.test(candidate))
      return candidate;
  }
  return null;
};

export const cloneableConfigurationError = (response: Response): Response =>
  response.clone();

export const unavailableConfiguration = (): AuthenticationError => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Configuration persistence is temporarily unavailable.',
  details: { dependencyClass: 'configuration', retryable: true },
  retryAfterSeconds: 5,
});

export type ConfigurationRunnerOutcome = ConfigurationOutcome;

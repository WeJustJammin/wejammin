import {
  Cfg05a01DefinitionResponseSchema,
  Cfg05a02EffectiveValueResponseSchema,
  Cfg05a03ChangeResponseSchema,
  Cfg05a04ChangeActionResponseSchema,
  Cfg05b01InboxResponseSchema,
  Cfg05b04CapabilityActionResponseSchema,
  Cfg05b05AuditDiagnosticResponseSchema,
  CapabilitySchema,
} from '@wejammin/contracts';

import { authError } from '../authentication/boundary';
import { callRpc } from '../authentication/production-http';
import { createAdminMfaResetPort } from './admin-mfa-reset-port';
import { normalizeConfigurationOptions } from './production-http';
import type { AuthProductionOptions } from '../authentication/production-configuration';
import type { AuthenticationSession } from '../authentication/types';
import type { WorkerBindings, WorkerDependencies } from '../index';
import {
  configurationCommandRpc,
  configurationDatabaseContext,
  configurationReadRpc,
} from './production-request';
import type {
  ConfigurationPortInput,
  ConfigurationCapabilityKeyReader,
  ConfigurationReleasePrincipalResolver,
  ConfigurationServiceConsumerResolver,
  PlatformConfigurationDependencies,
  PlatformConfigurationOperationId,
} from './types';

export const PLATFORM_CONFIGURATION_RPC = {
  registerDefinition: 'cfg_register_definition',
  resolveEffectiveValue: 'cfg_resolve_effective_value',
  proposeChange: 'cfg_propose_change',
  changeAction: 'cfg_change_action',
  readInbox: 'admin_inbox',
  capabilityAction: 'admin_capability_action',
  auditDiagnostic: 'admin_audit_diagnostic',
  contextCapabilities: 'admin_context_capabilities',
} as const;

export const configurationResponseSchemas = {
  'CFG-05A-01': Cfg05a01DefinitionResponseSchema,
  'CFG-05A-02': Cfg05a02EffectiveValueResponseSchema,
  'CFG-05A-03': Cfg05a03ChangeResponseSchema,
  'CFG-05A-04': Cfg05a04ChangeActionResponseSchema,
  'CFG-05B-01': Cfg05b01InboxResponseSchema,
  'CFG-05B-04': Cfg05b04CapabilityActionResponseSchema,
  'CFG-05B-05': Cfg05b05AuditDiagnosticResponseSchema,
} as const;

const pathValue = (
  input: ConfigurationPortInput,
  key: string,
): string | undefined => input.path?.[key];

const bodyValue = (
  input: ConfigurationPortInput,
): Readonly<Record<string, unknown>> => input.body ?? {};

const queryValue = (
  input: ConfigurationPortInput,
): Readonly<Record<string, unknown>> => input.query ?? {};

const asInput = (input: ConfigurationPortInput): ConfigurationPortInput =>
  input;

const MAX_CAPABILITY_KEYS = 64;

const invalidCapabilityResponse = (): never => {
  throw authError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Authorization context is temporarily unavailable.',
    { dependencyClass: 'request_context', retryable: true },
  );
};

const parseCapabilityKeys = (value: unknown): ReadonlyArray<string> => {
  if (!Array.isArray(value) || value.length > MAX_CAPABILITY_KEYS)
    return invalidCapabilityResponse();
  const keys = value.filter(
    (candidate): candidate is string =>
      CapabilitySchema.safeParse(candidate).success,
  );
  if (keys.length !== value.length || new Set(keys).size !== keys.length)
    return invalidCapabilityResponse();
  return keys;
};

const createProductionCapabilityKeyReader =
  (
    config: ReturnType<typeof normalizeConfigurationOptions>,
  ): ConfigurationCapabilityKeyReader =>
  async (session, request, _env, signal) => {
    try {
      return parseCapabilityKeys(
        await callRpc(
          config,
          PLATFORM_CONFIGURATION_RPC.contextCapabilities,
          {
            p_request: {
              context: configurationDatabaseContext({ request, session }),
            },
          },
          signal,
        ),
      );
    } catch (error) {
      if (signal.aborted) throw error;
      return invalidCapabilityResponse();
    }
  };

/**
 * Production transport owns persistence only. Credential verification is
 * supplied by the deployment's mTLS/service-binding authority and is never
 * inferred from HTTP headers in this module.
 */
export type PlatformConfigurationProductionOptions = AuthProductionOptions &
  Readonly<{
    resolveReleasePrincipal?: ConfigurationReleasePrincipalResolver;
    resolveServiceConsumer?: ConfigurationServiceConsumerResolver;
    resolveRequestContext?: WorkerDependencies['resolveRequestContext'];
    resolveCapabilities?: (
      session: AuthenticationSession,
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => ReadonlyArray<string> | Promise<ReadonlyArray<string>>;
  }>;

export const createProductionPlatformConfigurationDependencies = (
  options: PlatformConfigurationProductionOptions,
): PlatformConfigurationDependencies => {
  const config = normalizeConfigurationOptions(options);
  const readCapabilityKeys = createProductionCapabilityKeyReader(config);
  return {
    registerDefinition: (input, _env, signal) =>
      configurationCommandRpc(
        config,
        asInput(input),
        signal,
        PLATFORM_CONFIGURATION_RPC.registerDefinition,
        configurationResponseSchemas['CFG-05A-01'],
        bodyValue(input),
      ),
    resolveEffectiveValue: (input, _env, signal) =>
      configurationReadRpc(
        config,
        asInput(input),
        signal,
        PLATFORM_CONFIGURATION_RPC.resolveEffectiveValue,
        configurationResponseSchemas['CFG-05A-02'],
        {
          ...queryValue(input),
          key: pathValue(input, 'key') ?? queryValue(input).key,
        },
      ),
    proposeChange: (input, _env, signal) =>
      configurationCommandRpc(
        config,
        asInput(input),
        signal,
        PLATFORM_CONFIGURATION_RPC.proposeChange,
        configurationResponseSchemas['CFG-05A-03'],
        {
          ...bodyValue(input),
          definitionId: pathValue(input, 'definitionId'),
        },
      ),
    changeAction: (input, _env, signal) =>
      configurationCommandRpc(
        config,
        asInput(input),
        signal,
        PLATFORM_CONFIGURATION_RPC.changeAction,
        configurationResponseSchemas['CFG-05A-04'],
        {
          ...bodyValue(input),
          reviewId: pathValue(input, 'reviewId'),
        },
      ),
    readInbox: (input, _env, signal) =>
      configurationReadRpc(
        config,
        input,
        signal,
        PLATFORM_CONFIGURATION_RPC.readInbox,
        configurationResponseSchemas['CFG-05B-01'],
        queryValue(input),
      ),
    capabilityAction: (input, _env, signal) =>
      configurationCommandRpc(
        config,
        input,
        signal,
        PLATFORM_CONFIGURATION_RPC.capabilityAction,
        configurationResponseSchemas['CFG-05B-04'],
        bodyValue(input),
      ),
    auditDiagnostic: (input, _env, signal) => {
      if (bodyValue(input).action === 'run_diagnostic')
        return Promise.resolve(
          authError(
            422,
            'INVALID_REQUEST',
            'Diagnostic runs are deferred from this route.',
          ),
        );
      return configurationReadRpc(
        config,
        input,
        signal,
        PLATFORM_CONFIGURATION_RPC.auditDiagnostic,
        configurationResponseSchemas['CFG-05B-05'],
        bodyValue(input),
      );
    },
    resetMfaFactors: createAdminMfaResetPort(config),
    readCapabilityKeys,
    ...(options.resolveReleasePrincipal === undefined
      ? {}
      : { resolveReleasePrincipal: options.resolveReleasePrincipal }),
    ...(options.resolveServiceConsumer === undefined
      ? {}
      : { resolveServiceConsumer: options.resolveServiceConsumer }),
    ...(options.resolveRequestContext === undefined
      ? {}
      : { resolveRequestContext: options.resolveRequestContext }),
  };
};

export const createProductionConfigurationDependencies =
  createProductionPlatformConfigurationDependencies;

export type PlatformConfigurationResponseOperation =
  PlatformConfigurationOperationId;

import { z } from 'zod';

const SafeCodeSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/);

const SafeIdentifierSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);

const EntityIdHashSchema = z
  .string()
  // Use an absolute end assertion so a trailing newline cannot pass `$` and
  // become a log-field injection vector.
  .regex(/^sha256:[0-9a-f]{64}(?![\s\S])/);

const RouteTemplateSchema = z
  .string()
  .min(1)
  .max(240)
  .regex(/^\/[A-Za-z0-9_./:{}*-]*$/);

const LogAttributeValueSchema = z.union([
  SafeIdentifierSchema,
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const LogAttributesSchema = z.record(SafeCodeSchema, LogAttributeValueSchema);
/**
 * A metric key is a safe code, optionally followed by one closed label set in
 * the Prometheus exposition form `name{label="value",...}`: lowercase label
 * names and values restricted to the safe-code alphabet (no quotes, braces,
 * commas or whitespace inside a value), at most eight labels. The absolute end
 * assertion keeps a trailing newline from becoming a log-field injection.
 */
const MetricKeySchema = z
  .string()
  .max(240)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}(?:\{[a-z][a-z0-9_]{0,31}="[A-Za-z0-9_.:/-]{1,96}"(?:,[a-z][a-z0-9_]{0,31}="[A-Za-z0-9_.:/-]{1,96}"){0,7}\})?(?![\s\S])/,
  );
const LogMetricsSchema = z.record(
  MetricKeySchema,
  z.number().finite().nonnegative(),
);

export const LogSeveritySchema = z.enum([
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
]);

export const LogOutcomeSchema = z.enum([
  'success',
  'failure',
  'rejected',
  'retry',
  'unknown',
]);

export const LogEventDetailsSchema = z.strictObject({
  attributes: LogAttributesSchema.optional(),
  actingContextClass: SafeCodeSchema.optional(),
  actorClass: SafeCodeSchema.optional(),
  attempt: z.number().int().positive().optional(),
  causationId: SafeIdentifierSchema.optional(),
  consumer: SafeCodeSchema.optional(),
  correlationId: SafeIdentifierSchema.optional(),
  dependency: SafeCodeSchema.optional(),
  durationMs: z.number().finite().nonnegative().optional(),
  entityIdHash: EntityIdHashSchema.optional(),
  entityType: SafeCodeSchema.optional(),
  entityVersion: SafeIdentifierSchema.optional(),
  errorCode: SafeCodeSchema.optional(),
  eventName: SafeCodeSchema,
  jobId: SafeIdentifierSchema.optional(),
  operation: SafeCodeSchema,
  outcome: LogOutcomeSchema,
  requestId: SafeIdentifierSchema.optional(),
  retryable: z.boolean().optional(),
  routeTemplate: RouteTemplateSchema.optional(),
  traceId: SafeIdentifierSchema.optional(),
  traceSteps: z.array(SafeCodeSchema).max(16).optional(),
  metrics: LogMetricsSchema.optional(),
});

const LoggerConfigSchema = z.strictObject({
  environment: SafeCodeSchema,
  release: SafeIdentifierSchema,
  service: SafeCodeSchema,
});

export const LogEventSchema = LogEventDetailsSchema.extend({
  environment: SafeCodeSchema,
  release: SafeIdentifierSchema,
  service: SafeCodeSchema,
  severity: LogSeveritySchema,
  timestamp: z.iso.datetime(),
}).strict();

const LogWriteOptionsSchema = z.strictObject({
  highRisk: z.boolean().optional(),
  samplingClass: z
    .enum(['always', 'authenticated_success', 'public_success'])
    .optional(),
});

export type LogEvent = z.infer<typeof LogEventSchema>;
export type LogEventDetails = z.infer<typeof LogEventDetailsSchema>;
export type LogSeverity = z.infer<typeof LogSeveritySchema>;
export type LogWriteOptions = z.infer<typeof LogWriteOptionsSchema>;
export type LogWriteResult =
  'rejected' | 'sampled_out' | 'sink_failed' | 'written';

export type Logger = {
  debug: (
    details: LogEventDetails,
    options?: LogWriteOptions,
  ) => LogWriteResult;
  error: (
    details: LogEventDetails,
    options?: LogWriteOptions,
  ) => LogWriteResult;
  fatal: (
    details: LogEventDetails,
    options?: LogWriteOptions,
  ) => LogWriteResult;
  info: (details: LogEventDetails, options?: LogWriteOptions) => LogWriteResult;
  warn: (details: LogEventDetails, options?: LogWriteOptions) => LogWriteResult;
};

type LoggerConfig = z.input<typeof LoggerConfigSchema>;

type LoggerDependencies = {
  now?: () => Date;
  onDiagnostic?: (code: 'invalid_log_event' | 'log_sink_failure') => void;
  random?: () => number;
  sink?: (line: string) => void;
};

const samplingRates = {
  always: 1,
  authenticated_success: 0.1,
  public_success: 0.01,
} as const;

const consoleSink = (line: string): void => {
  console.info(JSON.parse(line) as LogEvent);
};

export const createLogger = (
  inputConfig: LoggerConfig,
  dependencies: LoggerDependencies = {},
): Logger => {
  const config = LoggerConfigSchema.parse(inputConfig);
  const now = dependencies.now ?? (() => new Date());
  const onDiagnostic = dependencies.onDiagnostic;
  const random = dependencies.random ?? Math.random;
  const sink = dependencies.sink ?? consoleSink;

  const reportDiagnostic = (
    code: 'invalid_log_event' | 'log_sink_failure',
  ): void => {
    try {
      onDiagnostic?.(code);
    } catch {
      // Telemetry diagnostics cannot affect the application path.
    }
  };

  const write = (event: LogEvent): LogWriteResult => {
    try {
      sink(JSON.stringify(event));
      return 'written';
    } catch {
      reportDiagnostic('log_sink_failure');
      return 'sink_failed';
    }
  };

  const reject = (): LogWriteResult => {
    reportDiagnostic('invalid_log_event');
    const diagnostic = LogEventSchema.parse({
      ...config,
      errorCode: 'invalid_log_event',
      eventName: 'observability.event_rejected',
      operation: 'telemetry.write',
      outcome: 'rejected',
      retryable: false,
      severity: 'WARN',
      timestamp: now().toISOString(),
    });
    write(diagnostic);
    return 'rejected';
  };

  const emit = (
    severity: LogSeverity,
    inputDetails: LogEventDetails,
    inputOptions: LogWriteOptions = {},
  ): LogWriteResult => {
    const detailsResult = LogEventDetailsSchema.safeParse(inputDetails);
    const optionsResult = LogWriteOptionsSchema.safeParse(inputOptions);
    if (!detailsResult.success || !optionsResult.success) {
      return reject();
    }

    const options = optionsResult.data;
    const samplingClass = options.samplingClass ?? 'always';
    const mustRetain =
      severity === 'ERROR' || severity === 'FATAL' || options.highRisk === true;
    if (!mustRetain && random() >= samplingRates[samplingClass]) {
      return 'sampled_out';
    }

    const event = LogEventSchema.parse({
      ...detailsResult.data,
      ...config,
      severity,
      timestamp: now().toISOString(),
    });
    return write(event);
  };

  return {
    debug: (details, options) => emit('DEBUG', details, options),
    error: (details, options) => emit('ERROR', details, options),
    fatal: (details, options) => emit('FATAL', details, options),
    info: (details, options) => emit('INFO', details, options),
    warn: (details, options) => emit('WARN', details, options),
  };
};

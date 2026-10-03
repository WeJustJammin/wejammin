import type { ContentSchemaRegistryMutationTarget } from './content-schema-registry-platform-shared';

const FORM_JSON_FIELDS = new Set([
  'fields',
  'relations',
  'templateBindings',
  'capabilityBindings',
  'constraints',
  'defaultValue',
  'editorConfig',
  'approvalIds',
  'supportedLocales',
  'fallbackChains',
]);
const FORM_BOOLEAN_FIELDS = new Set(['required', 'ordered', 'confirmed']);
const FORM_NUMBER_FIELDS = new Set(['min', 'max']);
const FORM_NULLABLE_FIELDS = new Set([
  'defaultTemplateVersionId',
  'validatorKey',
  'validatorVersion',
  'migrationPlanId',
  'transformKey',
  'transformVersion',
]);
const FORM_OPTIONAL_FIELDS = new Set([
  'stableFieldId',
  'defaultValue',
  'expectedActivationEvidenceHash',
  'reason',
]);
const FORM_TRANSPORT_FIELDS = new Set([
  'operationId',
  'csrf',
  'idempotency-key',
  'if-match',
  'stepUpToken',
  'confirmation',
  'confirmed',
  'localeChoice',
  'templateChoice',
  'contentTypeId',
  'versionId',
  'reviewId',
  'grantId',
]);

const PATH_IDENTIFIERS = [
  'contentTypeId',
  'versionId',
  'reviewId',
  'grantId',
] as const;

/**
 * A browser may echo the path identifier the route already bound, but it can
 * never introduce one the target does not declare or contradict one it does.
 */
const pathIdentifiersMatch = (
  target: ContentSchemaRegistryMutationTarget,
  supplied: (name: (typeof PATH_IDENTIFIERS)[number]) => string | null,
): boolean =>
  PATH_IDENTIFIERS.every((name) => {
    const value = supplied(name);
    return value === null || target[name] === value;
  });

export type MutationTransport = {
  readonly operationId: string | null;
  readonly csrfToken: string | null;
  readonly idempotencyKey: string | null;
  readonly ifMatch: string | null;
  readonly stepUpToken: string | null;
  readonly confirmed: boolean | null;
  readonly source: 'json' | 'form';
};

export type ParsedMutationInput = {
  readonly payload: unknown;
  readonly transport: MutationTransport;
};

export class MutationInputError extends Error {}

const textOrNull = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string')
    throw new MutationInputError(`${field}_invalid`);
  return value;
};

const parseJsonText = (value: string, field: string): unknown => {
  if (value.trim().length === 0 && field === 'defaultValue') return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new MutationInputError(`${field}_invalid`);
  }
};

export const parseFormDataInput = async (
  request: Request,
  target: ContentSchemaRegistryMutationTarget,
): Promise<ParsedMutationInput> => {
  let form: FormData;
  try {
    form = await request.clone().formData();
  } catch {
    throw new MutationInputError('form_invalid');
  }
  const values = new Map<string, string>();
  for (const [name, raw] of form.entries()) {
    if (typeof raw !== 'string') throw new MutationInputError('file_invalid');
    if (values.has(name)) throw new MutationInputError('duplicate_field');
    values.set(name, raw);
  }

  const suppliedOperation = values.get('operationId') ?? null;
  if (!pathIdentifiersMatch(target, (name) => values.get(name) ?? null))
    throw new MutationInputError('path_id_mismatch');

  const payload: Record<string, unknown> = {};
  let confirmed: boolean | null = null;
  for (const [name, value] of values) {
    if (FORM_TRANSPORT_FIELDS.has(name)) {
      if (name === 'confirmed') {
        if (value !== 'true' && value !== 'on')
          throw new MutationInputError('confirmed_invalid');
        confirmed = true;
      }
      continue;
    }
    if (FORM_JSON_FIELDS.has(name)) {
      const parsed = parseJsonText(value, name);
      if (parsed !== undefined) payload[name] = parsed;
      continue;
    }
    if (FORM_OPTIONAL_FIELDS.has(name) && value.trim() === '') continue;
    if (FORM_BOOLEAN_FIELDS.has(name)) {
      if (value !== 'true' && value !== 'on' && value !== 'false')
        throw new MutationInputError(`${name}_invalid`);
      payload[name] = value === 'true' || value === 'on';
      continue;
    }
    if (FORM_NUMBER_FIELDS.has(name)) {
      const number = Number(value);
      if (!Number.isFinite(number) || !Number.isInteger(number))
        throw new MutationInputError(`${name}_invalid`);
      payload[name] = number;
      continue;
    }
    payload[name] = value;
  }
  if (
    target.operationId === 'CMS-03A-02' &&
    !Object.hasOwn(payload, 'required')
  )
    payload.required = false;
  if (target.operationId === 'CMS-03A-03' && !Object.hasOwn(payload, 'ordered'))
    payload.ordered = false;
  // DEC-123: the create form carries no template inputs, so the request names
  // none. A posted value is kept as sent and is refused by the contract.
  if (target.operationId === 'CMS-03A-01') {
    if (!Object.hasOwn(payload, 'defaultTemplateVersionId'))
      payload.defaultTemplateVersionId = null;
    if (!Object.hasOwn(payload, 'templateBindings'))
      payload.templateBindings = [];
  }
  for (const field of FORM_NULLABLE_FIELDS) {
    if (values.has(field) && values.get(field)?.trim() === '')
      payload[field] = null;
  }
  return {
    payload,
    transport: {
      operationId: suppliedOperation,
      csrfToken: values.get('csrf') ?? null,
      idempotencyKey: values.get('idempotency-key') ?? null,
      ifMatch: values.get('if-match') ?? null,
      stepUpToken: values.get('stepUpToken') ?? null,
      confirmed,
      source: 'form',
    },
  };
};

export const parseJsonInput = async (
  request: Request,
  target: ContentSchemaRegistryMutationTarget,
): Promise<ParsedMutationInput> => {
  let value: unknown;
  try {
    value = await request.clone().json();
  } catch {
    throw new MutationInputError('json_invalid');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new MutationInputError('json_invalid');
  const input = { ...(value as Record<string, unknown>) };
  const suppliedOperation = textOrNull(input.operationId, 'operationId');
  const suppliedIdentifiers = new Map(
    PATH_IDENTIFIERS.map((name) => [name, textOrNull(input[name], name)]),
  );
  if (
    !pathIdentifiersMatch(
      target,
      (name) => suppliedIdentifiers.get(name) ?? null,
    )
  )
    throw new MutationInputError('path_id_mismatch');
  const csrfToken = textOrNull(input.csrf, 'csrf');
  const idempotencyKey = textOrNull(
    input['idempotency-key'],
    'idempotency-key',
  );
  const ifMatch = textOrNull(input['if-match'], 'if-match');
  const stepUpToken = textOrNull(input.stepUpToken, 'stepUpToken');
  const confirmedValue = input.confirmed;
  const confirmed =
    confirmedValue === undefined
      ? null
      : confirmedValue === true
        ? true
        : confirmedValue === false
          ? false
          : typeof confirmedValue === 'string' && confirmedValue === 'true'
            ? true
            : (() => {
                throw new MutationInputError('confirmed_invalid');
              })();
  for (const key of [
    'operationId',
    ...PATH_IDENTIFIERS,
    'csrf',
    'idempotency-key',
    'if-match',
    'stepUpToken',
    'confirmation',
    'confirmed',
  ]) {
    delete input[key];
  }
  return {
    payload: input,
    transport: {
      operationId: suppliedOperation,
      csrfToken,
      idempotencyKey,
      ifMatch,
      stepUpToken,
      confirmed,
      source: 'json',
    },
  };
};

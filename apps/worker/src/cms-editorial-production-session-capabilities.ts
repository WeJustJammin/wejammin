import { CapabilitySchema } from '@wejammin/contracts';

const MAX_CAPABILITIES = 64;

export const validCapabilities = (
  values: unknown,
): values is readonly string[] =>
  Array.isArray(values) &&
  values.length <= MAX_CAPABILITIES &&
  values.every((value) => CapabilitySchema.safeParse(value).success) &&
  new Set(values).size === values.length;

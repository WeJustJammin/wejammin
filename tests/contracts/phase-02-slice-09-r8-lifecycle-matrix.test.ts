import { describe, expect, it } from 'vitest';

import { ContentSchemaRegistryListQuerySchema } from '@wejammin/contracts';

const LIFECYCLES = [
  'active',
  'retired',
  'deprecated',
  'supported',
  'withdrawn',
] as const;
const ACCEPTED = {
  content_type: ['active', 'retired'],
  field_definition_version: ['active', 'deprecated', 'retired'],
  block_definition_registry_record: ['supported', 'deprecated', 'withdrawn'],
} as const;
const STATE_ONLY = [
  'content_type_version',
  'relation_definition',
  'schema_artifact',
  'template_binding',
  'capability_binding',
] as const;

const accepts = (query: Record<string, unknown>): boolean =>
  ContentSchemaRegistryListQuerySchema.safeParse(query).success;

describe('[P2-S09-AC-127] the lifecycle filter is a closed union compatible with the resourceKind', () => {
  it.each(Object.entries(ACCEPTED))(
    'accepts exactly the matrix values for %s and refuses every other lifecycle',
    (resourceKind, accepted) => {
      for (const lifecycle of LIFECYCLES)
        expect(
          accepts({ resourceKind, lifecycle }),
          `${resourceKind} + ${lifecycle}`,
        ).toBe((accepted as readonly string[]).includes(lifecycle));
    },
  );

  it.each(STATE_ONLY)(
    'refuses every lifecycle filter on the state-only kind %s',
    (resourceKind) => {
      for (const lifecycle of LIFECYCLES)
        expect(accepts({ resourceKind, lifecycle })).toBe(false);
      expect(accepts({ resourceKind, state: 'draft' })).toBe(true);
    },
  );

  it('accepts any member of the union with no resourceKind and refuses a value outside it', () => {
    for (const lifecycle of LIFECYCLES)
      expect(accepts({ lifecycle })).toBe(true);
    for (const lifecycle of ['draft', 'ACTIVE', '', 'unknown', null, 1])
      expect(accepts({ lifecycle })).toBe(false);
  });

  it('refuses a state filter on every lifecycle-bearing kind', () => {
    for (const resourceKind of Object.keys(ACCEPTED))
      expect(accepts({ resourceKind, state: 'draft' })).toBe(false);
  });
});

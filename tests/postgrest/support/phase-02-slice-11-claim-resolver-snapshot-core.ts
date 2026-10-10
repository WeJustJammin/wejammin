/** Pure additional resolver observer: no database, stack or command imports. */
export const CLAIM_RESOLVER_TABLES = [
  'platform_private.jobs',
  'platform_private.processed_events',
  'platform_private.cms_content_types',
  'platform_private.cms_content_type_versions',
  'platform_private.cms_field_definition_versions',
  'platform_private.cms_relation_definitions',
  'platform_private.cms_content_type_template_bindings',
  'platform_private.cms_content_type_capability_bindings',
  'platform_private.cms_schema_artifacts',
  'platform_private.cms_schema_migration_plans',
  'platform_private.cms_schema_dry_run_reports',
  'platform_private.cms_schema_dry_run_row_evidence',
  'platform_private.cms_schema_migration_target_rows',
] as const;

export type ClaimResolverTable = (typeof CLAIM_RESOLVER_TABLES)[number];
export type ClaimResolverSnapshot = Readonly<
  Record<ClaimResolverTable, string>
>;
export type ClaimResolverRowTextOverrides = Readonly<
  Partial<Record<ClaimResolverTable, string>>
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decodeGroup = (value: unknown): string => {
  if (!isRecord(value))
    throw new Error('claim resolver snapshot group is not an object');
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'count' || keys[1] !== 'sha')
    throw new Error(
      'claim resolver snapshot group members differ from {count,sha}',
    );
  const { count, sha } = value;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
    throw new Error('claim resolver snapshot group has no safe integer count');
  if (
    typeof sha !== 'string' ||
    sha.length !== 64 ||
    !/^[0-9a-f]{64}$/u.test(sha)
  )
    throw new Error('claim resolver snapshot group has no sha256 digest');
  return `${count}:${sha}`;
};

/** Fixed diagnostics only: group names and rejected values never enter errors. */
export const decodeClaimResolverSnapshot = (
  raw: string,
): ClaimResolverSnapshot => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('claim resolver snapshot is not JSON');
  }
  if (!isRecord(parsed))
    throw new Error('claim resolver snapshot is not an object');
  const actual = Object.keys(parsed).sort();
  const expected = [...CLAIM_RESOLVER_TABLES].sort();
  if (
    actual.length !== expected.length ||
    !actual.every((key, index) => key === expected[index])
  )
    throw new Error(
      'claim resolver snapshot groups differ from the closed set',
    );
  // Explicit construction preserves the exact-table return type without a cast.
  return Object.freeze({
    'platform_private.jobs': decodeGroup(parsed['platform_private.jobs']),
    'platform_private.processed_events': decodeGroup(
      parsed['platform_private.processed_events'],
    ),
    'platform_private.cms_content_types': decodeGroup(
      parsed['platform_private.cms_content_types'],
    ),
    'platform_private.cms_content_type_versions': decodeGroup(
      parsed['platform_private.cms_content_type_versions'],
    ),
    'platform_private.cms_field_definition_versions': decodeGroup(
      parsed['platform_private.cms_field_definition_versions'],
    ),
    'platform_private.cms_relation_definitions': decodeGroup(
      parsed['platform_private.cms_relation_definitions'],
    ),
    'platform_private.cms_content_type_template_bindings': decodeGroup(
      parsed['platform_private.cms_content_type_template_bindings'],
    ),
    'platform_private.cms_content_type_capability_bindings': decodeGroup(
      parsed['platform_private.cms_content_type_capability_bindings'],
    ),
    'platform_private.cms_schema_artifacts': decodeGroup(
      parsed['platform_private.cms_schema_artifacts'],
    ),
    'platform_private.cms_schema_migration_plans': decodeGroup(
      parsed['platform_private.cms_schema_migration_plans'],
    ),
    'platform_private.cms_schema_dry_run_reports': decodeGroup(
      parsed['platform_private.cms_schema_dry_run_reports'],
    ),
    'platform_private.cms_schema_dry_run_row_evidence': decodeGroup(
      parsed['platform_private.cms_schema_dry_run_row_evidence'],
    ),
    'platform_private.cms_schema_migration_target_rows': decodeGroup(
      parsed['platform_private.cms_schema_migration_target_rows'],
    ),
  });
};

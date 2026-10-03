import type {
  ContentSchemaRegistryQuery,
  ContentSchemaRegistryResourceKind,
} from './content-schema-registry-types';

interface Props {
  readonly query: ContentSchemaRegistryQuery;
  readonly canonicalUrl: string;
}

const resourceKinds: readonly ContentSchemaRegistryResourceKind[] = [
  'content_type',
  'content_type_version',
  'field_definition_version',
  'relation_definition',
  'schema_artifact',
  'template_binding',
  'capability_binding',
  'block_definition_registry_record',
];
const lifecycleValues = [
  'active',
  'retired',
  'deprecated',
  'supported',
  'withdrawn',
] as const;
const stateValues = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
] as const;

export const contentSchemaRegistryFilterSummary = (
  query: ContentSchemaRegistryQuery,
): string => {
  const filters = [
    query.resourceKind === undefined
      ? null
      : `resource kind ${query.resourceKind}`,
    query.keyPrefix === undefined ? null : `key prefix ${query.keyPrefix}`,
    query.lifecycle === undefined ? null : `lifecycle ${query.lifecycle}`,
    query.state === undefined ? null : `state ${query.state}`,
  ].filter((value): value is string => value !== null);

  return filters.length === 0
    ? 'No filters are applied.'
    : `Active filters: ${filters.join('; ')}.`;
};

const SORT_LABELS = {
  key: 'Key',
  createdAt: 'Created',
  updatedAt: 'Updated',
  version: 'Version',
} as const;

export const contentSchemaRegistrySortSummary = (
  query: ContentSchemaRegistryQuery,
): string =>
  `Sorted by ${SORT_LABELS[query.sort]}, ${
    query.direction === 'asc' ? 'ascending' : 'descending'
  }.`;

export default function ContentSchemaRegistryFilterBar({
  query,
  canonicalUrl,
}: Props) {
  return (
    <form
      className="content-schema-registry-filters"
      method="get"
      action={canonicalUrl}
      aria-describedby="content-schema-registry-filter-help content-schema-registry-filter-summary content-schema-registry-sort-summary"
    >
      <p id="content-schema-registry-filter-help">
        Filters are URL state. Lifecycle filters apply to lifecycle-bearing
        resources; state filters apply to state-only resources.
      </p>
      <p id="content-schema-registry-filter-summary">
        {contentSchemaRegistryFilterSummary(query)}
      </p>
      <p id="content-schema-registry-sort-summary">
        {contentSchemaRegistrySortSummary(query)}
      </p>
      <div className="content-schema-registry-filter-grid">
        <label htmlFor="content-schema-registry-resource-kind">
          Resource kind
          <select
            id="content-schema-registry-resource-kind"
            name="resourceKind"
            defaultValue={query.resourceKind ?? ''}
          >
            <option value="">All resource kinds</option>
            {resourceKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="content-schema-registry-key-prefix">
          Key prefix
          <input
            id="content-schema-registry-key-prefix"
            name="keyPrefix"
            inputMode="text"
            maxLength={64}
            pattern="[a-z][a-z0-9._-]{0,63}"
            defaultValue={query.keyPrefix ?? ''}
          />
        </label>
        <label htmlFor="content-schema-registry-lifecycle">
          Lifecycle
          <select
            id="content-schema-registry-lifecycle"
            name="lifecycle"
            defaultValue={query.lifecycle ?? ''}
          >
            <option value="">Any lifecycle</option>
            {lifecycleValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="content-schema-registry-state">
          State
          <select
            id="content-schema-registry-state"
            name="state"
            defaultValue={query.state ?? ''}
          >
            <option value="">Any state</option>
            {stateValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="content-schema-registry-limit">
          Results per page
          <input
            id="content-schema-registry-limit"
            name="limit"
            type="number"
            min={1}
            max={100}
            defaultValue={query.limit}
          />
        </label>
        <label htmlFor="content-schema-registry-sort">
          Sort by
          <select
            id="content-schema-registry-sort"
            name="sort"
            aria-label="Sort registry records"
            defaultValue={query.sort}
          >
            <option value="key">Key</option>
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="version">Version</option>
          </select>
        </label>
        <label htmlFor="content-schema-registry-direction">
          Direction
          <select
            id="content-schema-registry-direction"
            name="direction"
            aria-label="Sort direction"
            defaultValue={query.direction}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
      <div className="content-schema-registry-filter-actions">
        <button type="submit">Apply filters</button>
        <a href={canonicalUrl}>Reset filters</a>
      </div>
    </form>
  );
}

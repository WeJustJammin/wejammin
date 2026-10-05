import type {
  ContentSchemaRegistryListPage,
  ContentSchemaRegistryQuery,
  ContentSchemaRegistryRecord,
} from './content-schema-registry-types';

interface Props {
  readonly page: ContentSchemaRegistryListPage;
  readonly canonicalUrl: string;
  readonly listUrl: string;
  /** The applied server sort; the matching visible column carries `aria-sort`. */
  readonly sort?: Pick<ContentSchemaRegistryQuery, 'sort' | 'direction'>;
  /**
   * The applied query. When present, each sortable column header carries a
   * native submit button that commits the sort (and the toggled direction) as
   * URL state while keeping every other filter.
   */
  readonly query?: ContentSchemaRegistryQuery;
}

const SORT_KEYS = {
  Key: 'key',
  Version: 'version',
  Updated: 'updatedAt',
} as const;
const FILTER_FIELDS = [
  'resourceKind',
  'keyPrefix',
  'lifecycle',
  'state',
  'limit',
] as const;

/** Header sort control: a one-button GET form so it works before hydration. */
const SortButton = ({
  props,
  column,
}: {
  readonly props: Props;
  readonly column: keyof typeof SORT_KEYS;
}) => {
  const query = props.query;
  if (query === undefined) return <>{column}</>;
  const key = SORT_KEYS[column];
  const current = query.sort === key;
  const direction = current && query.direction === 'asc' ? 'desc' : 'asc';
  const label = current
    ? `Sort by ${column}, currently ${query.direction === 'asc' ? 'ascending' : 'descending'}; activate to sort ${direction === 'asc' ? 'ascending' : 'descending'}`
    : `Sort by ${column}, ascending`;
  return (
    <form
      method="get"
      action={props.canonicalUrl}
      className="content-schema-registry-sort-form"
    >
      {FILTER_FIELDS.map((field) =>
        query[field] === undefined ? null : (
          <input
            key={field}
            type="hidden"
            name={field}
            value={String(query[field])}
          />
        ),
      )}
      <input type="hidden" name="sort" value={key} />
      <input type="hidden" name="direction" value={direction} />
      <button type="submit" aria-label={label}>
        {column}
      </button>
    </form>
  );
};

/** The visible column each server sort key orders (created is not a column). */
const SORT_COLUMNS = {
  key: 'Key',
  version: 'Version',
  updatedAt: 'Updated',
} as const;

const sortAttribute = (
  props: Props,
  column: (typeof SORT_COLUMNS)[keyof typeof SORT_COLUMNS],
): { readonly 'aria-sort'?: 'ascending' | 'descending' } => {
  const sorted =
    props.sort === undefined
      ? undefined
      : (SORT_COLUMNS as Readonly<Record<string, string>>)[props.sort.sort];
  return props.sort !== undefined && sorted === column
    ? {
        'aria-sort':
          props.sort.direction === 'asc' ? 'ascending' : 'descending',
      }
    : {};
};

const recordKey = (record: ContentSchemaRegistryRecord): string => {
  switch (record.resourceKind) {
    case 'content_type':
    case 'content_type_version':
      return record.typeKey;
    case 'field_definition_version':
      return record.key;
    case 'relation_definition':
      return record.projectionKey;
    case 'schema_artifact':
      return record.zodContractRef;
    case 'template_binding':
      return record.templateVersionId;
    case 'capability_binding':
      return record.capabilityKey;
    case 'block_definition_registry_record':
      return record.blockKey;
  }
};

const stateOrLifecycle = (record: ContentSchemaRegistryRecord): string => {
  if ('lifecycle' in record) return record.lifecycle;
  return record.state;
};

const updatedValue = (record: ContentSchemaRegistryRecord): string | null =>
  'updatedAt' in record ? record.updatedAt : null;

const detailHref = (
  record: ContentSchemaRegistryRecord,
  listUrl: string,
): string | null => {
  if (record.resourceKind !== 'content_type_version') return null;
  const url = new URL(listUrl, 'https://content-schema-registry.invalid');
  url.pathname = `${url.pathname.replace(/\/$/u, '')}/${encodeURIComponent(
    record.contentTypeId,
  )}/versions/${encodeURIComponent(record.id)}`;
  return `${url.pathname}${url.search}`;
};

/** Facts only a content type row carries (it has no version detail). */
const TypeFacts = ({
  record,
}: {
  readonly record: ContentSchemaRegistryRecord;
}) =>
  record.resourceKind === 'content_type' ? (
    <small data-safe-field="contentType">
      Type ID <code>{record.id}</code> ·{' '}
      {record.builtIn ? 'Built-in type' : 'Custom type'} · Created{' '}
      <time dateTime={record.createdAt}>{record.createdAt}</time>
    </small>
  ) : null;

const detailFocusKey = (record: ContentSchemaRegistryRecord): string =>
  `content-schema-registry-view-${record.id}`;

export default function ContentSchemaRegistryList(props: Props) {
  const { page, canonicalUrl, listUrl } = props;
  const nextUrl =
    page.nextCursor === null
      ? null
      : (() => {
          const url = new URL(
            listUrl,
            'https://content-schema-registry.invalid',
          );
          url.searchParams.set('cursor', page.nextCursor);
          return `${url.pathname}${url.search}`;
        })();

  return (
    <section
      className="content-schema-registry-list"
      aria-labelledby="content-schema-registry-list-heading"
    >
      <h3 id="content-schema-registry-list-heading">Registry records</h3>
      <div className="content-schema-registry-table-wrap">
        <table>
          <caption>Server-verified content schema registry records</caption>
          <thead>
            <tr>
              <th scope="col">Resource kind</th>
              <th scope="col" {...sortAttribute(props, 'Key')}>
                <SortButton props={props} column="Key" />
              </th>
              <th scope="col" {...sortAttribute(props, 'Version')}>
                <SortButton props={props} column="Version" />
              </th>
              <th scope="col">Lifecycle or state</th>
              <th scope="col" {...sortAttribute(props, 'Updated')}>
                <SortButton props={props} column="Updated" />
              </th>
              <th scope="col">
                <span className="visually-hidden">Inspect</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((record) => (
              <tr key={`${record.resourceKind}:${record.id}`}>
                <td data-label="Resource kind">
                  <code>{record.resourceKind}</code>
                </td>
                <td data-label="Key">
                  <code>{recordKey(record)}</code>
                </td>
                <td data-label="Version">{record.version}</td>
                <td data-label="Lifecycle or state">
                  {stateOrLifecycle(record)}
                </td>
                <td data-label="Updated">
                  {updatedValue(record) === null ? (
                    'Not supplied'
                  ) : (
                    <time dateTime={updatedValue(record) ?? undefined}>
                      {updatedValue(record)}
                    </time>
                  )}
                </td>
                <td data-label="Inspect">
                  {detailHref(record, listUrl) === null ? (
                    <span>Included in version detail</span>
                  ) : (
                    <a
                      id={detailFocusKey(record)}
                      data-cms-focus-key={detailFocusKey(record)}
                      href={detailHref(record, listUrl) ?? canonicalUrl}
                    >
                      View details
                    </a>
                  )}
                  <TypeFacts record={record} />
                  {record.resourceKind ===
                  'block_definition_registry_record' ? (
                    <small data-safe-field="releaseDigest">
                      Release digest <code>{record.releaseDigest}</code>
                    </small>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol
        className="content-schema-registry-priority-list"
        aria-label="Registry records priority list"
      >
        {page.items.map((record) => {
          const href = detailHref(record, listUrl);
          return (
            <li key={`priority:${record.resourceKind}:${record.id}`}>
              <strong>
                <code>{recordKey(record)}</code>
              </strong>
              <dl>
                <dt>Resource kind</dt>
                <dd>
                  <code>{record.resourceKind}</code>
                </dd>
                <dt>Version</dt>
                <dd>{record.version}</dd>
                <dt>Lifecycle or state</dt>
                <dd>{stateOrLifecycle(record)}</dd>
                <dt>Updated</dt>
                <dd>{updatedValue(record) ?? 'Not supplied'}</dd>
              </dl>
              <TypeFacts record={record} />
              {href === null ? (
                <span>Included in version detail</span>
              ) : (
                <a
                  id={`${detailFocusKey(record)}-priority`}
                  data-cms-focus-key={detailFocusKey(record)}
                  href={href}
                >
                  View details
                </a>
              )}
            </li>
          );
        })}
      </ol>
      {nextUrl !== null ? (
        <a className="content-schema-registry-next" href={nextUrl}>
          Next page
        </a>
      ) : null}
    </section>
  );
}

import ContentSchemaRegistryStatus from './ContentSchemaRegistryStatus';
import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
  ContentSchemaRegistryVariant,
} from './content-schema-registry-types';

export type ContentSchemaRegistryInitialFailure = Extract<
  ContentSchemaRegistryListState | ContentSchemaRegistryDetailState,
  { readonly status: 'error' | 'degraded' }
>;

interface Props {
  readonly failure: ContentSchemaRegistryInitialFailure;
  readonly access: Extract<ContentSchemaRegistryAccess, 'disabled'>;
  readonly variant: ContentSchemaRegistryVariant;
  readonly supportReference: string;
  readonly retryUrl: string;
}

/** Preserve an exact server read failure when authority is unavailable. */
export default function ContentSchemaRegistryInitialFailureBoundary({
  failure,
  access,
  variant,
  supportReference,
  retryUrl,
}: Props) {
  return (
    <section
      className="content-schema-registry"
      data-workbench="content-schema-registry"
      data-access={access}
      data-variant={variant}
      data-canonical-refetch-url={retryUrl}
      aria-labelledby="content-schema-registry-initial-error-heading"
    >
      <h2 id="content-schema-registry-initial-error-heading">
        Content schema registry
      </h2>
      <ContentSchemaRegistryStatus
        state={failure}
        regionLabel="Registry"
        supportReference={supportReference}
        canonicalUrl={retryUrl}
      />
    </section>
  );
}

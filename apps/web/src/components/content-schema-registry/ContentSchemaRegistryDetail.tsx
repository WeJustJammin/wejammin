import ContentSchemaRegistryLocaleSummaryView from './ContentSchemaRegistryLocaleSummaryView';
import ContentSchemaRegistryStatus from './ContentSchemaRegistryStatus';
import type {
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistrySafeBlockProjection,
} from './content-schema-registry-types';

interface Props {
  readonly state: ContentSchemaRegistryDetailState | null;
  readonly backUrl: string;
  readonly retryUrl: string;
  readonly supportReference: string;
}

const SafeBlock = ({
  block,
}: {
  readonly block: ContentSchemaRegistrySafeBlockProjection;
}) => (
  <li>
    <strong>{block.blockKey}</strong> v{block.blockVersion} ({block.lifecycle})
    <dl className="content-schema-registry-block-meta">
      <dt>Props schema reference</dt>
      <dd>
        <code>{block.propsSchemaRef}</code>
      </dd>
      <dt>Props schema hash</dt>
      <dd>
        <code>{block.propsSchemaHash}</code>
      </dd>
      <dt>Renderer reference</dt>
      <dd>
        <code>{block.rendererRef}</code>
      </dd>
      <dt>Release digest</dt>
      <dd>
        <code>{block.releaseDigest}</code>
      </dd>
    </dl>
  </li>
);

export default function ContentSchemaRegistryDetail({
  state,
  backUrl,
  retryUrl,
  supportReference,
}: Props) {
  if (state === null) {
    return (
      <section
        className="content-schema-registry-detail"
        aria-labelledby="content-schema-registry-detail-heading"
      >
        <h3 id="content-schema-registry-detail-heading">Version detail</h3>
        <p>Select a registry record to view its version detail.</p>
      </section>
    );
  }
  if (state.status !== 'success') {
    return (
      <section
        className="content-schema-registry-detail"
        aria-labelledby="content-schema-registry-detail-heading"
      >
        <h3 id="content-schema-registry-detail-heading">Version detail</h3>
        <ContentSchemaRegistryStatus
          state={state}
          regionLabel="Version detail"
          supportReference={supportReference}
          canonicalUrl={retryUrl}
        />
      </section>
    );
  }

  const detail = state.data;
  const resource = detail.resource;
  return (
    <section
      className="content-schema-registry-detail"
      aria-labelledby="content-schema-registry-detail-heading"
    >
      <div className="content-schema-registry-detail-heading">
        <div>
          <p className="content-schema-registry-eyebrow">Selected version</p>
          <h3 id="content-schema-registry-detail-heading">{resource.label}</h3>
        </div>
        <a href={backUrl}>Back to registry</a>
      </div>
      <dl className="content-schema-registry-summary">
        <dt>Type key</dt>
        <dd>
          <code>{resource.typeKey}</code>
        </dd>
        <dt>Content type ID</dt>
        <dd>
          <code>{resource.contentTypeId}</code>
        </dd>
        <dt>Version</dt>
        <dd>{resource.version}</dd>
        <dt>State</dt>
        <dd>{resource.state}</dd>
        <dt>Content hash</dt>
        <dd>
          <code>{resource.contentHash}</code>
        </dd>
        <dt>Updated</dt>
        <dd>
          <time dateTime={resource.updatedAt}>{resource.updatedAt}</time>
        </dd>
      </dl>
      <ContentSchemaRegistryLocaleSummaryView resource={resource} />
      <section aria-labelledby="content-schema-registry-fields-heading">
        <h4 id="content-schema-registry-fields-heading">Fields</h4>
        {detail.fields.length === 0 ? (
          <p>No field definitions are attached to this version.</p>
        ) : (
          <ul>
            {detail.fields.map((field) => (
              <li key={field.id}>
                <strong>{field.key}</strong> <code>{field.kind}</code> —{' '}
                {field.required ? 'required' : 'optional'}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="content-schema-registry-relations-heading">
        <h4 id="content-schema-registry-relations-heading">Relations</h4>
        {detail.relations.length === 0 ? (
          <p>No relations are attached to this version.</p>
        ) : (
          <ul>
            {detail.relations.map((relation) => (
              <li key={relation.id}>
                <strong>{relation.projectionKey}</strong> —{' '}
                {relation.cardinality} → {relation.targetType}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="content-schema-registry-blocks-heading">
        <h4 id="content-schema-registry-blocks-heading">Supported blocks</h4>
        {detail.blockDefinitions.length === 0 ? (
          <p>No safe block projections are attached to this version.</p>
        ) : (
          <ul>
            {detail.blockDefinitions.map((block) => (
              <SafeBlock key={block.id} block={block} />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="content-schema-registry-artifact-heading">
        <h4 id="content-schema-registry-artifact-heading">
          Compiled schema artifact
        </h4>
        <p>
          <code>{detail.schemaArtifact.zodContractRef}</code> · compiler{' '}
          {detail.schemaArtifact.compilerVersion}
        </p>
      </section>
      {resource.activationEvidence !== null ? (
        <section aria-labelledby="content-schema-registry-activation-heading">
          <h4 id="content-schema-registry-activation-heading">
            Activation evidence
          </h4>
          <p>
            Policy <code>{resource.activationEvidence.key}</code> ·{' '}
            {resource.activationEvidence.riskClass} ·{' '}
            {resource.activationEvidence.requiredDecisionCount} decision(s)
          </p>
        </section>
      ) : null}
    </section>
  );
}

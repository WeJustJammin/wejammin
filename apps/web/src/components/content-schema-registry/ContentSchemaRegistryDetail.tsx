import {
  ContentSchemaRegistryDetailArtifact,
  ContentSchemaRegistryDetailEvidence,
} from './ContentSchemaRegistryDetailArtifact';
import ContentSchemaRegistryDetailBindings from './ContentSchemaRegistryDetailBindings';
import ContentSchemaRegistryDetailDefinitions from './ContentSchemaRegistryDetailDefinitions';
import ContentSchemaRegistryDetailFacts from './ContentSchemaRegistryDetailFacts';
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
      <dt>Registry record ID</dt>
      <dd>
        <code>{block.id}</code>
      </dd>
      <dt>Registry record version</dt>
      <dd>{block.version}</dd>
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
        <a href={backUrl}>Back to registry</a>
        <div>
          <p className="content-schema-registry-eyebrow">Selected version</p>
          <h3 id="content-schema-registry-detail-heading">{resource.label}</h3>
        </div>
      </div>
      <ContentSchemaRegistryDetailFacts resource={resource} />
      <ContentSchemaRegistryLocaleSummaryView resource={resource} />
      <ContentSchemaRegistryDetailDefinitions detail={detail} />
      <ContentSchemaRegistryDetailBindings detail={detail} />
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
      <ContentSchemaRegistryDetailArtifact artifact={detail.schemaArtifact} />
      {resource.activationEvidence !== null ? (
        <ContentSchemaRegistryDetailEvidence
          evidence={resource.activationEvidence}
        />
      ) : null}
    </section>
  );
}

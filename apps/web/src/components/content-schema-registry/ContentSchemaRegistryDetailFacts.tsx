import * as React from 'react';

import type { ContentSchemaRegistryDetail } from './content-schema-registry-types';

type Resource = ContentSchemaRegistryDetail['resource'];

/** One definition-list row; a nullable value renders the stated empty text. */
export const Fact = ({
  term,
  children,
}: {
  readonly term: string;
  readonly children: React.ReactNode;
}): React.ReactElement => (
  <>
    <dt>{term}</dt>
    <dd>{children}</dd>
  </>
);

export const Instant = ({
  value,
}: {
  readonly value: string;
}): React.ReactElement => <time dateTime={value}>{value}</time>;

export const Code = ({
  value,
  none = 'None',
}: {
  readonly value: string | null;
  readonly none?: string;
}): React.ReactElement => (value === null ? <>{none}</> : <code>{value}</code>);

/**
 * FE03 `ContentSchemaRegistryDetail.resource` (CMS-03A-07): the identity,
 * state, ownership, workflow, counts and evidence references of one content
 * type version. The locale members render in their own section.
 */
export default function ContentSchemaRegistryDetailFacts({
  resource,
}: {
  readonly resource: Resource;
}): React.ReactElement {
  return (
    <dl className="content-schema-registry-summary">
      <Fact term="Type key">
        <code>{resource.typeKey}</code>
      </Fact>
      <Fact term="Content type ID">
        <code>{resource.contentTypeId}</code>
      </Fact>
      <Fact term="Version ID">
        <code>{resource.id}</code>
      </Fact>
      <Fact term="Version">{resource.version}</Fact>
      <Fact term="State">{resource.state}</Fact>
      <Fact term="Content hash">
        <code>{resource.contentHash}</code>
      </Fact>
      <Fact term="Created">
        <Instant value={resource.createdAt} />
      </Fact>
      <Fact term="Updated">
        <Instant value={resource.updatedAt} />
      </Fact>
      <Fact term="Owner capability">
        <code>{resource.ownerCapability}</code>
      </Fact>
      <Fact term="Workflow">
        <code>{resource.workflowKey}</code> version {resource.workflowVersion}
      </Fact>
      <Fact term="Default template version">
        <Code value={resource.defaultTemplateVersionId} />
      </Fact>
      <Fact term="Schema artifact ID">
        <code>{resource.schemaArtifactId}</code>
      </Fact>
      <Fact term="Field definitions">{resource.fieldCount}</Fact>
      <Fact term="Relations">{resource.relationCount}</Fact>
      <Fact term="Capability bindings">{resource.capabilityBindingCount}</Fact>
      <Fact term="Compatibility">{resource.compatibility}</Fact>
      <Fact term="Dry run ID">
        <Code value={resource.dryRunId} />
      </Fact>
    </dl>
  );
}

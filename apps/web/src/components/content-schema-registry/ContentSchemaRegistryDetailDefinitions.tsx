import * as React from 'react';

import { Code, Fact, Instant } from './ContentSchemaRegistryDetailFacts';
import type { ContentSchemaRegistryDetail } from './content-schema-registry-types';

type Field = ContentSchemaRegistryDetail['fields'][number];
type Relation = ContentSchemaRegistryDetail['relations'][number];

const validatorText = (field: Field): React.ReactElement =>
  field.validatorKey === null ? (
    <>None</>
  ) : (
    <>
      <code>{field.validatorKey}</code> version {field.validatorVersion}
    </>
  );

const FieldItem = ({ field }: { readonly field: Field }) => (
  <li>
    <strong>{field.key}</strong> <code>{field.kind}</code> —{' '}
    {field.required ? 'required' : 'optional'}
    <dl className="content-schema-registry-block-meta">
      <Fact term="Field version ID">
        <code>{field.id}</code>
      </Fact>
      <Fact term="Stable field ID">
        <code>{field.stableFieldId}</code>
      </Fact>
      <Fact term="Version">{field.version}</Fact>
      <Fact term="Lifecycle">{field.lifecycle}</Fact>
      <Fact term="Default mode">{field.defaultMode}</Fact>
      <Fact term="Localization mode">{field.localizationMode}</Fact>
      <Fact term="Validator">{validatorText(field)}</Fact>
      <Fact term="Migration plan ID">
        <Code value={field.migrationPlanId} />
      </Fact>
      <Fact term="Content hash">
        <code>{field.contentHash}</code>
      </Fact>
      <Fact term="Created">
        <Instant value={field.createdAt} />
      </Fact>
      <Fact term="Updated">
        <Instant value={field.updatedAt} />
      </Fact>
    </dl>
  </li>
);

const RelationItem = ({ relation }: { readonly relation: Relation }) => (
  <li>
    <strong>{relation.projectionKey}</strong> — {relation.cardinality} →{' '}
    {relation.targetType}
    <dl className="content-schema-registry-block-meta">
      <Fact term="Relation ID">
        <code>{relation.id}</code>
      </Fact>
      <Fact term="Field ID">
        <code>{relation.fieldId}</code>
      </Fact>
      <Fact term="Target kind">{relation.targetKind}</Fact>
      <Fact term="Minimum related records">{relation.min}</Fact>
      <Fact term="Maximum related records">{relation.max}</Fact>
      <Fact term="Order preserved">{relation.ordered ? 'Yes' : 'No'}</Fact>
      <Fact term="When target is unavailable">{relation.onUnavailable}</Fact>
      <Fact term="State">{relation.state}</Fact>
      <Fact term="Version">{relation.version}</Fact>
      <Fact term="Content hash">
        <code>{relation.contentHash}</code>
      </Fact>
      <Fact term="Created">
        <Instant value={relation.createdAt} />
      </Fact>
      <Fact term="Updated">
        <Instant value={relation.updatedAt} />
      </Fact>
    </dl>
  </li>
);

/** FE03 detail: field definitions and relation policy of one version. */
export default function ContentSchemaRegistryDetailDefinitions({
  detail,
}: {
  readonly detail: ContentSchemaRegistryDetail;
}): React.ReactElement {
  return (
    <>
      <section aria-labelledby="content-schema-registry-fields-heading">
        <h4 id="content-schema-registry-fields-heading">Fields</h4>
        {detail.fields.length === 0 ? (
          <p>No field definitions are attached to this version.</p>
        ) : (
          <ul>
            {detail.fields.map((field) => (
              <FieldItem key={field.id} field={field} />
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
              <RelationItem key={relation.id} relation={relation} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

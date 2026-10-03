import * as React from 'react';

import { Fact } from './ContentSchemaRegistryDetailFacts';
import type { ContentSchemaRegistryDetail } from './content-schema-registry-types';

/** FE03 detail: template and capability bindings of one version. */
export default function ContentSchemaRegistryDetailBindings({
  detail,
}: {
  readonly detail: ContentSchemaRegistryDetail;
}): React.ReactElement {
  return (
    <>
      <section aria-labelledby="content-schema-registry-templates-heading">
        <h4 id="content-schema-registry-templates-heading">
          Template bindings
        </h4>
        {detail.templateBindings.length === 0 ? (
          <p>No template versions are bound to this version.</p>
        ) : (
          <ul>
            {detail.templateBindings.map((binding) => (
              <li key={binding.id}>
                <code>{binding.templateVersionId}</code>
                <dl className="content-schema-registry-block-meta">
                  <Fact term="Binding ID">
                    <code>{binding.id}</code>
                  </Fact>
                  <Fact term="Position">{binding.position}</Fact>
                  <Fact term="Version">{binding.version}</Fact>
                  <Fact term="State">{binding.state}</Fact>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="content-schema-registry-capabilities-heading">
        <h4 id="content-schema-registry-capabilities-heading">
          Capability bindings
        </h4>
        {detail.capabilityBindings.length === 0 ? (
          <p>No capabilities are bound to this version.</p>
        ) : (
          <ul>
            {detail.capabilityBindings.map((binding) => (
              <li key={binding.id}>
                <code>{binding.capabilityKey}</code> version{' '}
                {binding.capabilityVersion}
                <dl className="content-schema-registry-block-meta">
                  <Fact term="Binding ID">
                    <code>{binding.id}</code>
                  </Fact>
                  <Fact term="Version">{binding.version}</Fact>
                  <Fact term="State">{binding.state}</Fact>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * The detail region of a route with no selected version. It is rendered by the
 * list route itself, so it lives outside the lazily loaded detail view.
 */
export default function ContentSchemaRegistryDetailPlaceholder() {
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

// Structured data for search engines (ARCHITECTURE ADR-18), written on the server as a script
// tag. `<` is escaped so text inside the data can never close the tag early.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

// The only place that renders JSON-LD. Mounted once (org graph) in app/layout.tsx
// and per study page (Course + BreadcrumbList). no HTML-escaping inside the JSON
// island, and no client JS: engines that do not run JS still see the graph.
// dangerouslySetInnerHTML is the documented Next/React way to emit a <script> body.
export function JsonLd({ nodes }: { nodes: unknown[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }),
      }}
    />
  );
}

import { SITE } from './site';

// The site-wide graph, mounted once in app/layout.tsx. @id-anchored so every
// Course.provider can reference it instead of repeating it 217 times (this is what
// keeps the JSON-LD payload cheap on the deep pages).
export function orgNodes() {
  return [
    {
      '@type': 'EducationalOrganization',
      '@id': `${SITE.origin}/#organization`,
      name: 'Octav Learning',
      alternateName: 'Octav Learning — KS3, IGCSE and IB DP study platform',
      url: `${SITE.origin}/`,
      logo: {
        '@type': 'ImageObject',
        '@id': `${SITE.origin}/#logo`,
        url: `${SITE.origin}/icons/icon-512.png`,
        width: 512,
        height: 512,
        caption: 'Octav Learning',
      },
      // PWA source icon is a square mark on a light field — the safe asset for a logo signal.
      image: { '@id': `${SITE.origin}/#logo` },
      description:
        'Illustrated notes, smart flashcards, diagnostic tests and timed mock exams for UK Key Stage 3, IGCSE and the IB Diploma Programme, across ten subjects.',
      disambiguatingDescription:
        'An independent online study resource. Octav Learning is not an IB World School, not a Cambridge Assessment International Education exam centre, and awards no qualifications; it is not endorsed by or affiliated with the IBO or CAIE.',
      // We prepare students FOR a credential; we never award one. Saying so in markup keeps the
      // EducationalOrganization + educationalCredentialAwarded combination truthful.
      knowsLanguage: ['en-GB'],
      inLanguage: ['en-GB'],
      areaServed: [
        { '@type': 'Country', name: 'United Kingdom' },
        { '@type': 'Country', name: 'United Arab Emirates' },
        { '@type': 'Country', name: 'Singapore' },
        { '@type': 'Country', name: 'Germany' },
        { '@type': 'Country', name: 'Switzerland' },
        { '@type': 'Country', name: 'India' },
        { '@type': 'Country', name: 'Australia' },
        { '@type': 'Place', name: 'International schools worldwide' },
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'info@octavlearning.com',
        availableLanguage: ['en-GB'],
        // Contact Us feature (docs/supportability-features-plan.md) is the real channel;
        // Cloudflare Email Routing -> info@ verified 2026-08-28.
      },
      sameAs: [], // fill as social profiles land — an empty array is worse than omitting the key
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE.origin}/#website`,
      url: `${SITE.origin}/`,
      name: 'Octav Learning',
      inLanguage: 'en-GB',
      publisher: { '@id': `${SITE.origin}/#organization` },
      // No SearchAction: sitelinks searchbox is retired (Nov 2024) and our search is a
      // client-side filter over one subject's topics, not a site-wide search endpoint.
    },
  ];
}

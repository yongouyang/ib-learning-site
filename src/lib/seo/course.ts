import type { Topic } from '@/content/types';
import { SITE } from './site';
import {
  tierMeta,
  tierOfTopic,
  curriculumLabel,
  credentialFor,
  courseCodeFor,
  STUDY_PATH,
  tierHubPath,
  tierSubjectPath,
} from './curriculum';

export function courseNode(topic: Topic, lastModified: string | null) {
  const url = `${SITE.origin}${STUDY_PATH(topic)}`;
  return {
    '@type': 'Course',
    '@id': `${url}#course`,
    // courseCode is optional but powers engine-side filtering; make it derivable, not invented.
    courseCode: courseCodeFor(topic), // real: math-yr7-angles -> "MATH-KS3-Y7-ANGLES"
    name: topic.title,
    description: topic.description,
    url,
    inLanguage: SITE.inLanguage,
    // curriculum identity — the whole point of this template
    educationalLevel: curriculumLabel(topic), // "Key Stage 3, Year 7" / "International GCSE" / "IB DP Maths AI (SL)"
    ...(credentialFor(topic) // null for every KS3 topic — verified via the executed generator run
      ? {
          // Only emitted where a qualification actually exists. KS3 awards nothing, so
          // educationalCredentialAwarded is omitted rather than faked.
          educationalCredentialAwarded: {
            '@type': 'EducationalOccupationalCredential',
            name: credentialFor(topic), // "IGCSE" | "IB Diploma Programme certificate"
            credentialCategory: 'qualification',
            recognizedTerminology: credentialFor(topic),
          },
        }
      : {}),
    learningResourceType: ['Study notes', 'Flashcards', 'Practice questions'],
    // real content, not marketing copy: one entry per note heading
    teaches: topic.notes.map((n) => n.heading),
    provider: { '@id': `${SITE.origin}/#organization` },
    isAccessibleForFree: true, // policy: tier-0 content is never gated (src/lib/entitlements/features.ts)
    accessibility: {
      '@type': 'AccessibilityFeature',
      accessMode: 'Visual',
      accessModeSufficient: ['text'],
      accessibilityFeature: ['structuralTags', 'readingOrder', 'highContrastDisplay'],
    },
    ...(lastModified ? { dateModified: lastModified, timeRequired: 'PT20M' } : {}),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkMode: 'self-paced',
      url,
      inLanguage: SITE.inLanguage,
    },
  };
}

export function breadcrumbNode(topic: Topic, subjectName: string) {
  const tier = tierMeta(topic);
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.origin}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: tier.hubTitle,
        item: `${SITE.origin}${tierHubPath(tierOfTopic(topic))}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${tier.label} ${subjectName}`,
        item: `${SITE.origin}${tierSubjectPath(tierOfTopic(topic), topic.subjectId)}`,
      },
      { '@type': 'ListItem', position: 4, name: topic.title, item: `${SITE.origin}${STUDY_PATH(topic)}` },
    ],
  };
}

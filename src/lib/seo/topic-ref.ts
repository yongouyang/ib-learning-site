import { getSubject, getTopic } from '@/content/registry';
import type { SubjectId, Topic } from '@/content/types';

/**
 * Registry lookup for the /subjects/[subjectId]/[topicId] segment pair, resolved once so
 * generateMetadata and the page share it. Topic carries only `subjectId`; the metadata and
 * JSON-LD builders need the display name, which lives on the Subject.
 *
 * Returns null for an unknown pair. In the static export only the generateStaticParams
 * combinations exist (unknown URLs 404 at CloudFront), so a null here is a dev/e2e-only path.
 */
export function findTopic(
  subjectId: string,
  topicId: string,
): { topic: Topic; subjectName: string } | null {
  const subject = getSubject(subjectId as SubjectId);
  const topic = subject && getTopic(subjectId as SubjectId, topicId);
  return topic && subject ? { topic, subjectName: subject.name } : null;
}

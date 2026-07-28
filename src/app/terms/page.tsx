import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use — IBLearn',
  description: 'Terms of use and content licensing for IBLearn.',
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">Terms of Use</h1>

      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">Content ownership</h2>
          <p>
            All study notes, flashcards, quizzes, practice papers, markschemes, and illustrations on
            IBLearn are original works created for this site and are protected by copyright. All
            rights reserved.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">Permitted use</h2>
          <p>
            You may use IBLearn for personal, non-commercial study. You may not copy, republish,
            redistribute, or sell any part of the content, in whole or in part, without prior
            written permission.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">No AI training</h2>
          <p>
            The content on this site may not be scraped, harvested, or otherwise used to train,
            fine-tune, or evaluate machine-learning models or AI systems.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">Independence</h2>
          <p>
            IBLearn is an independent study resource and is not endorsed by or affiliated with the
            International Baccalaureate Organization (IBO) or Cambridge Assessment International
            Education (CAIE).
          </p>
        </section>
      </div>
    </div>
  );
}

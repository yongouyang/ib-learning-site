interface StudyNoteIllustrationProps {
  src: string;
  alt: string;
  caption?: string;
}

export default function StudyNoteIllustration({ src, alt, caption }: StudyNoteIllustrationProps) {
  return (
    <figure className="my-4">
      <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Plain <img>: local SVGs get no next/image optimisation, and this lets
            each illustration keep its intrinsic aspect ratio (full width). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full h-auto p-3" />
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

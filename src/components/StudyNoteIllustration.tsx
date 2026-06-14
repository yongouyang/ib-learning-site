import Image from 'next/image';

interface StudyNoteIllustrationProps {
  src: string;
  alt: string;
  caption?: string;
}

export default function StudyNoteIllustration({ src, alt, caption }: StudyNoteIllustrationProps) {
  return (
    <figure className="my-4">
      <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain p-3"
          sizes="(max-width: 768px) 100vw, 42rem"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

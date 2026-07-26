// Phase 6 — RV-style dual-ring donut for flashcard progress.
// Outer ring = Seen %, inner ring = Known %. Pure SVG (SSR-safe, no chart lib).
interface DualRingDonutProps {
  seen: number;
  known: number;
  total: number;
  size?: number;
}

function Ring({ radius, fraction, className }: { radius: number; fraction: number; className: string }) {
  const circumference = 2 * Math.PI * radius;
  return (
    <>
      <circle r={radius} fill="none" strokeWidth={6} className="stroke-gray-200 dark:stroke-gray-700" />
      {fraction > 0 && (
        <circle
          r={radius}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`}
          transform="rotate(-90)"
          className={className}
        />
      )}
    </>
  );
}

export default function DualRingDonut({ seen, known, total, size = 56 }: DualRingDonutProps) {
  const seenFraction = total > 0 ? Math.min(seen / total, 1) : 0;
  const knownFraction = total > 0 ? Math.min(known / total, 1) : 0;
  const center = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Flashcards: ${known} known of ${seen} seen, ${total} total`}
      className="shrink-0"
    >
      <g transform={`translate(${center} ${center})`}>
        <Ring radius={center - 4} fraction={seenFraction} className="stroke-blue-400 dark:stroke-blue-500" />
        <Ring radius={center - 12} fraction={knownFraction} className="stroke-green-500 dark:stroke-green-400" />
      </g>
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-900 dark:fill-gray-50"
        fontSize={size / 4.5}
        fontWeight={700}
      >
        {total > 0 ? `${Math.round(knownFraction * 100)}%` : '–'}
      </text>
    </svg>
  );
}

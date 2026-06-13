'use client';

import {
  LevelFilter,
  TopicFilterState,
} from '@/lib/topic-filter';

interface TopicFilterProps {
  value: TopicFilterState;
  onChange: (value: TopicFilterState) => void;
  resultCount: number;
}

const levelOptions: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'MYP', label: 'MYP' },
  { value: 'DP', label: 'DP' },
];

export function TopicFilter({ value, onChange, resultCount }: TopicFilterProps) {
  const update = (partial: Partial<TopicFilterState>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="space-y-3 mb-4">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          🔍
        </span>
        <input
          type="text"
          value={value.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="Search topics..."
          aria-label="Search topics"
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {value.query && (
          <button
            type="button"
            onClick={() => update({ query: '' })}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {levelOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update({ level: option.value })}
              aria-pressed={value.level === option.value}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                value.level === option.value
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="text-sm text-gray-500 dark:text-gray-400">
          {resultCount} topic{resultCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

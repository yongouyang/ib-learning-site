'use client';

import { Search, X } from 'lucide-react';
import {
  StageFilter,
  TopicFilterState,
} from '@/lib/topic-filter';

interface TopicFilterProps {
  value: TopicFilterState;
  onChange: (value: TopicFilterState) => void;
  resultCount: number;
}

const stageOptions: { value: StageFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ks3', label: 'KS3' },
  { value: 'igcse', label: 'IGCSE' },
  { value: 'dp', label: 'IB DP' },
];

export function TopicFilter({ value, onChange, resultCount }: TopicFilterProps) {
  const update = (partial: Partial<TopicFilterState>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="space-y-3 mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
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
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {stageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update({ stage: option.value })}
              aria-pressed={value.stage === option.value}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                value.stage === option.value
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

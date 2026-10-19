import { ArrowRight, GitMerge } from 'lucide-react';
import React from 'react';
import type { MergeSuggestion } from '../types/attendance.js';

interface MergeSuggestionsPanelProps {
  suggestions: MergeSuggestion[];
  onConfirmMerge: (suggestion: MergeSuggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

export const MergeSuggestionsPanel: React.FC<MergeSuggestionsPanelProps> = ({
  suggestions,
  onConfirmMerge,
  onDismissSuggestion,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 mb-6">
      <div className="flex items-center space-x-2 text-indigo-900 font-semibold text-sm mb-3">
        <GitMerge className="w-4 h-4 text-indigo-600" />
        <span>Subject Merge Suggestions ({suggestions.length})</span>
      </div>

      <div className="space-y-2">
        {suggestions.map((sug) => (
          <div
            key={sug.id}
            className="bg-white rounded-xl border border-indigo-100 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">{sug.subjectAName}</span>
              <span className="text-slate-400 mx-1.5">and</span>
              <span className="font-semibold text-slate-900">{sug.subjectBName}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{sug.reason}</p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => onDismissSuggestion(sug.id)}
                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Keep Separate
              </button>
              <button
                type="button"
                onClick={() => onConfirmMerge(sug)}
                className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center space-x-1"
              >
                <span>Merge Records</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

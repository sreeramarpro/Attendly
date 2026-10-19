import { AlertCircle, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import React, { useState } from 'react';
import type { ParsingWarning } from '../types/attendance.js';

interface WarningsPanelProps {
  warnings: ParsingWarning[];
  onOpenEditSubject?: (subjectName: string) => void;
}

export const WarningsPanel: React.FC<WarningsPanelProps> = ({ warnings, onOpenEditSubject }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (warnings.length === 0) return null;

  return (
    <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 mb-6 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-amber-900 font-semibold text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span>Attention Needed: {warnings.length} Parsing Warning{warnings.length > 1 ? 's' : ''}</span>
          <span className="text-[11px] font-normal text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
            Valid subjects are calculated normally
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-amber-800 hover:text-amber-900 font-medium flex items-center space-x-1"
        >
          <span>{isExpanded ? 'Hide Warnings' : 'Show Warnings'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {warnings.map((warn) => (
            <div
              key={warn.id}
              className="bg-white rounded-xl border border-amber-200/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs text-xs text-slate-700"
            >
              <div className="space-y-0.5">
                <div className="font-medium text-slate-900 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{warn.message}</span>
                </div>
                {warn.snippet && (
                  <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block">
                    Snippet: "{warn.snippet}"
                  </div>
                )}
                {warn.suggestedAction && (
                  <p className="text-[11px] text-amber-700">{warn.suggestedAction}</p>
                )}
              </div>

              {warn.subjectName && onOpenEditSubject && (
                <button
                  type="button"
                  onClick={() => onOpenEditSubject(warn.subjectName!)}
                  className="px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 font-medium flex items-center space-x-1 shrink-0 self-start sm:self-auto"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Review / Edit</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import {
  AlertTriangle,
  Award,
  BookMarked,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import React from 'react';
import type { OverallCalculationSummary } from '../types/attendance.js';

interface SummaryCardsProps {
  summary: OverallCalculationSummary;
  targetPercentage?: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, targetPercentage = 75 }) => {
  const overall = summary.grandOverallPercentage;

  // Determine status color for overall attendance
  const getBadgeStyle = (pct: number | null) => {
    if (pct === null) return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
    if (pct >= targetPercentage) {
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    }
    if (pct >= targetPercentage - 10) {
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    }
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
  };

  const statusStyle = getBadgeStyle(overall);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Subjects */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Subjects Detected</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookMarked className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{summary.totalSubjects}</span>
          <span className="text-xs text-slate-500">
            ({summary.validSubjects} valid)
          </span>
        </div>
      </div>

      {/* Components Count */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Components</span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{summary.totalComponents}</span>
          <span className="text-xs text-slate-500">
            ({summary.validComponentsCount} valid
            {summary.invalidComponentsCount > 0 ? `, ${summary.invalidComponentsCount} excluded` : ''})
          </span>
        </div>
      </div>

      {/* Successfully Interpreted vs Incomplete */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Validation Health</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            {summary.incompleteSubjects > 0 || summary.invalidComponentsCount > 0 || summary.warningSubjects > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{summary.validSubjects}</span>
          <span className="text-xs text-slate-500">
            {summary.invalidComponentsCount > 0
              ? `${summary.invalidComponentsCount} excluded`
              : summary.incompleteSubjects > 0
              ? `${summary.incompleteSubjects} incomplete`
              : summary.unverifiedComponentsCount > 0
              ? `${summary.unverifiedComponentsCount} unverified`
              : summary.warningSubjects > 0
              ? `${summary.warningSubjects} warnings`
              : summary.totalSubjects > 0 && summary.validSubjects === summary.totalSubjects
              ? 'all verified'
              : 'none'}
          </span>
        </div>
      </div>

      {/* Overall Grand Attendance */}
      <div className={`rounded-2xl border p-4 shadow-sm ${statusStyle.bg} ${statusStyle.border}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${statusStyle.text}`}>Grand Attendance</span>
          <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center">
            <Award className={`w-4 h-4 ${statusStyle.text}`} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className={`text-2xl font-extrabold tracking-tight ${statusStyle.text}`}>
            {summary.formattedGrandPercentage}
          </span>
          {overall !== null ? (
            <span className="text-xs text-slate-600 font-medium">
              ({summary.grandTotalWeightedAttended.toFixed(1)} / {summary.grandTotalWeightedConducted.toFixed(1)} weighted)
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">
              {summary.statusMessage || 'No valid records'}
            </span>
          )}
        </div>
        {summary.statusMessage && overall !== null && (
          <div className="mt-1 text-[11px] font-medium text-amber-700">
            {summary.statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};

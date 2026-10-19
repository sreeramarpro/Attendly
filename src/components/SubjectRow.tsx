import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit,
} from 'lucide-react';
import React, { useState } from 'react';
import { formatSingleSubjectText } from '../engine/exporter.js';
import type { SubjectCalculation } from '../types/attendance.js';

interface SubjectRowProps {
  calculation: SubjectCalculation;
  targetPercentage?: number;
  onEdit: (subjectId: string) => void;
  onShowToast: (msg: string) => void;
}

export const SubjectRow: React.FC<SubjectRowProps> = ({
  calculation,
  targetPercentage = 75,
  onEdit,
  onShowToast,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const overall = calculation.overallPercentage;

  const getStatusColor = (pct: number | null) => {
    if (pct === null) return 'text-slate-500 bg-slate-100';
    if (pct >= targetPercentage) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (pct >= targetPercentage - 10) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getProgressBarColor = (pct: number | null) => {
    if (pct === null) return 'bg-slate-300';
    if (pct >= targetPercentage) return 'bg-emerald-500';
    if (pct >= targetPercentage - 10) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatSingleSubjectText(calculation);
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    onShowToast(`Copied results for ${calculation.subjectName}`);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="border border-slate-200/90 rounded-xl bg-white mb-3 shadow-xs hover:border-slate-300 transition-all overflow-hidden">
      {/* Primary Row Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
      >
        {/* Left: Code, Name, Components */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {calculation.subjectCode && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {calculation.subjectCode}
              </span>
            )}
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {calculation.subjectName}
            </h3>

            {/* Validation / Partial / Incomplete badges */}
            {calculation.statusMessage && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  calculation.isPartiallyValid
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {calculation.statusMessage}
              </span>
            )}
            {!calculation.statusMessage && calculation.hasWarnings && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                Warning
              </span>
            )}
          </div>

          {/* Component pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {calculation.components.map((comp) => {
              const isInvalid = comp.validationStatus === 'invalid';
              const isUnverified = comp.validationStatus === 'unverified';
              return (
                <span
                  key={comp.componentId}
                  title={comp.validationReason}
                  className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                    isInvalid
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : isUnverified
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {comp.name}:{' '}
                  <span className={`font-semibold ${isInvalid ? 'text-rose-800' : 'text-slate-800'}`}>
                    {comp.attended ?? '-'}/{comp.conducted ?? '-'}
                  </span>
                  {comp.percentage !== null && (
                    <span className={`ml-1 ${isInvalid ? 'text-rose-500 line-through' : 'text-slate-500'}`}>
                      ({comp.formattedPercentage})
                    </span>
                  )}
                  {isInvalid && <span className="ml-1 text-[10px] font-bold text-rose-600">(Excluded)</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Center / Right: Progress & Percentage */}
        <div className="flex items-center space-x-6 justify-between md:justify-end">
          {/* Weighted totals & Target message */}
          <div className="text-right">
            <div className="text-xs text-slate-500">
              Weighted:{' '}
              <span className="font-semibold text-slate-800">
                {calculation.totalWeightedAttended.toFixed(1)} / {calculation.totalWeightedConducted.toFixed(1)}
              </span>
            </div>

            {/* Target analysis tip */}
            {calculation.targetAnalysis && (
              <div className="text-[11px] font-medium mt-0.5">
                {calculation.targetAnalysis.status === 'above' && (
                  <span className="text-emerald-700">
                    Can miss{' '}
                    <strong className="font-bold underline">
                      {calculation.targetAnalysis.classesCanMiss}
                    </strong>{' '}
                    class{calculation.targetAnalysis.classesCanMiss === 1 ? '' : 'es'}
                  </span>
                )}
                {calculation.targetAnalysis.status === 'below' && (
                  <span className="text-rose-700">
                    Need{' '}
                    <strong className="font-bold underline">
                      {calculation.targetAnalysis.classesNeeded}
                    </strong>{' '}
                    more class{calculation.targetAnalysis.classesNeeded === 1 ? '' : 'es'}
                  </span>
                )}
                {calculation.targetAnalysis.status === 'on_track' && (
                  <span className="text-emerald-600">Exactly at target ({targetPercentage}%)</span>
                )}
              </div>
            )}
          </div>

          {/* Big Percentage Badge & Progress Bar */}
          <div className="flex flex-col items-end w-28">
            <div
              className={`text-base font-extrabold px-2.5 py-1 rounded-lg border text-right tracking-tight ${getStatusColor(
                overall
              )}`}
            >
              {calculation.formattedPercentage}
            </div>
            {overall !== null && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(
                    overall
                  )}`}
                  style={{ width: `${Math.min(100, Math.max(0, overall))}%` }}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              title="Copy subject attendance report"
            >
              {hasCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(calculation.subjectId);
              }}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Edit subject or components"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details Breakdown */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
            Component Contribution Breakdown
          </h4>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2 text-left">Component</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Attended</th>
                  <th className="px-3 py-2 text-center">Conducted</th>
                  <th className="px-3 py-2 text-center">Absent</th>
                  <th className="px-3 py-2 text-center">Weight</th>
                  <th className="px-3 py-2 text-center">Component %</th>
                  <th className="px-3 py-2 text-right">Weighted Attended</th>
                  <th className="px-3 py-2 text-right">Weighted Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {calculation.components.map((c) => {
                  const isInvalid = c.validationStatus === 'invalid';
                  return (
                    <tr key={c.componentId} className={isInvalid ? 'bg-rose-50/30' : 'hover:bg-slate-50/50'}>
                      <td className="px-3 py-2 font-medium text-slate-900">{c.name}</td>
                      <td className="px-3 py-2 text-center">
                        {c.validationStatus === 'valid' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                            Valid
                          </span>
                        ) : isInvalid ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium"
                            title={c.validationReason}
                          >
                            Excluded
                          </span>
                        ) : (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium"
                            title={c.validationReason}
                          >
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-center ${isInvalid ? 'text-rose-700 font-medium' : ''}`}>
                        {c.attended ?? '-'}
                      </td>
                      <td className={`px-3 py-2 text-center ${isInvalid ? 'text-rose-700 font-medium' : ''}`}>
                        {c.conducted ?? '-'}
                      </td>
                      <td className={`px-3 py-2 text-center ${isInvalid ? 'text-rose-700 font-medium' : ''}`}>
                        {c.absent ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{c.weight.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-center font-medium ${isInvalid ? 'line-through text-rose-500' : ''}`}>
                        {c.percentage !== null ? c.formattedPercentage : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-indigo-600 font-semibold">
                        {isInvalid ? '0.00' : c.weightedAttended.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {isInvalid ? '0.00' : c.weightedConducted.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/90 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    Trusted Contribution Total
                  </td>
                  <td className="px-3 py-2 text-center">{calculation.totalAttended}</td>
                  <td className="px-3 py-2 text-center">{calculation.totalConducted}</td>
                  <td className="px-3 py-2 text-center">{calculation.totalAbsent}</td>
                  <td className="px-3 py-2 text-center">-</td>
                  <td className="px-3 py-2 text-center font-bold text-indigo-700">
                    {calculation.formattedPercentage}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-indigo-700">
                    {calculation.totalWeightedAttended.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {calculation.totalWeightedConducted.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Excluded invalid components callout */}
          {calculation.invalidComponentsCount > 0 && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex flex-col gap-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Invalid component records excluded from trusted calculations:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 ml-1">
                {calculation.components
                  .filter((c) => c.validationStatus === 'invalid')
                  .map((c) => (
                    <li key={c.componentId}>
                      <strong>{c.name}:</strong> {c.validationReason}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Formula explanation box */}
          <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-800">Formula Explanation: </span>
            <code className="text-slate-700 font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
              {calculation.formulaExplanation}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};

import {
  Calculator,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import React from 'react';
import type { ProjectionResult, QuestionResult } from '../types/attendance.js';

interface InteractionCardProps {
  questionResult?: QuestionResult;
  projectionResult?: ProjectionResult;
  ambiguousPrompt?: string;
  onDismiss: () => void;
}

export const InteractionCard: React.FC<InteractionCardProps> = ({
  questionResult,
  projectionResult,
  ambiguousPrompt,
  onDismiss,
}) => {
  if (!questionResult && !projectionResult && !ambiguousPrompt) return null;

  if (ambiguousPrompt) {
    const isConversationalNotice = /no\s+(?:actionable\s+)?attendance\s+data/i.test(ambiguousPrompt);
    return (
      <div
        className={`bg-white rounded-2xl border ${
          isConversationalNotice ? 'border-slate-200' : 'border-amber-200'
        } shadow-sm p-6 mb-6 transition-all animate-fadeIn`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div
              className={`p-2.5 rounded-xl ${
                isConversationalNotice ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600'
              } shrink-0`}
            >
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isConversationalNotice ? 'text-slate-600' : 'text-amber-700'
                  }`}
                >
                  {isConversationalNotice ? 'Notice' : 'Clarification Needed'}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                {isConversationalNotice ? 'No Attendance Data Detected' : 'Incomplete or Ambiguous Information'}
              </h4>
              <p className="text-sm text-slate-700 mt-1.5 leading-relaxed font-medium">
                {ambiguousPrompt}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (questionResult) {
    return (
      <div className="bg-white rounded-2xl border border-indigo-200/80 shadow-sm p-6 mb-6 transition-all animate-fadeIn">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div className={`p-2.5 rounded-xl ${questionResult.hasData ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
              {questionResult.hasData ? <CheckCircle2 className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  {questionResult.hasData ? 'Attendance Query Result' : 'Notice'}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                {questionResult.hasData ? 'Your Current Attendance' : 'No Records Found'}
              </h4>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                {questionResult.message}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (projectionResult) {
    return (
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 rounded-2xl border border-indigo-200 shadow-sm p-6 mb-6 transition-all animate-fadeIn">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Hypothetical Attendance Projection
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                Simulation & Impact Analysis
              </h4>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Dismiss
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          {projectionResult.baselinePercentage !== undefined && (
            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3.5 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Current Baseline
              </span>
              <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                {projectionResult.baselinePercentage.toFixed(2)}%
              </div>
              {projectionResult.baselineAttended !== undefined && projectionResult.baselineConducted !== undefined && (
                <span className="text-xs text-slate-500">
                  {projectionResult.baselineAttended}/{projectionResult.baselineConducted} classes
                </span>
              )}
            </div>
          )}

          {projectionResult.targetPercentage !== undefined && (
            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3.5 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Target Percentage
              </span>
              <div className="text-lg font-extrabold text-indigo-600 mt-0.5">
                {projectionResult.targetPercentage.toFixed(2)}%
              </div>
              <span className="text-xs text-indigo-500">Goal threshold</span>
            </div>
          )}

          {projectionResult.classesNeeded !== undefined && (
            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3.5 border border-amber-200/80 bg-amber-50/30">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                Classes Needed
              </span>
              <div className="text-lg font-extrabold text-amber-900 mt-0.5">
                {projectionResult.classesNeeded}
              </div>
              <span className="text-xs text-amber-700">consecutive classes</span>
            </div>
          )}

          {projectionResult.projectedPercentage !== undefined && (
            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3.5 border border-emerald-200/80 bg-emerald-50/30">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Projected Overall
              </span>
              <div className="text-lg font-extrabold text-emerald-800 mt-0.5 flex items-center space-x-1">
                <span>{projectionResult.projectedPercentage.toFixed(2)}%</span>
                {projectionResult.percentageDelta !== undefined && (
                  <span className="text-xs font-bold text-emerald-600">
                    ({projectionResult.percentageDelta >= 0 ? '+' : ''}{projectionResult.percentageDelta.toFixed(2)}%)
                  </span>
                )}
              </div>
              {projectionResult.projectedAttended !== undefined && projectionResult.projectedConducted !== undefined && (
                <span className="text-xs text-emerald-600">
                  {projectionResult.projectedAttended}/{projectionResult.projectedConducted} classes
                </span>
              )}
            </div>
          )}
        </div>

        {/* Full Explanation Text */}
        <div className="p-3.5 rounded-xl bg-white/90 border border-indigo-100 text-xs sm:text-sm text-slate-700 leading-relaxed flex items-start space-x-2.5">
          <Calculator className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>{projectionResult.explanation}</span>
        </div>
      </div>
    );
  }

  return null;
};

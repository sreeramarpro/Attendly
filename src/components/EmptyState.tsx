import { ArrowRight, Sparkles } from 'lucide-react';
import React from 'react';
import { SAMPLE_PRESETS, type SamplePreset } from '../data/samplePresets.js';

interface EmptyStateProps {
  onSelectPreset: (preset: SamplePreset) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPreset }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 sm:p-12 text-center max-w-3xl mx-auto my-8">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
        <Sparkles className="w-8 h-8" />
      </div>

      {/* Main Title & Description */}
      <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
        Ready to Calculate Your Attendance
      </h3>
      <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
        Paste any attendance text above—ERP tables, natural sentences, or shorthand. Attendly figures out your subjects, components, and weighted percentages automatically.
      </p>

      {/* 3 Value Props */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2.5 font-bold text-xs">
            1
          </div>
          <h4 className="text-xs font-bold text-slate-900 mb-1">Zero Formatting Needed</h4>
          <p className="text-[11px] text-slate-500 leading-normal">
            No need to format into rows or clean up ERP tables. Paste text directly from PDF, portal, or chat.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2.5 font-bold text-xs">
            2
          </div>
          <h4 className="text-xs font-bold text-slate-900 mb-1">Component Weighting</h4>
          <p className="text-[11px] text-slate-500 leading-normal">
            Lectures, labs, tutorials, and skills are weighted correctly according to university standards.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2.5 font-bold text-xs">
            3
          </div>
          <h4 className="text-xs font-bold text-slate-900 mb-1">Private & Local</h4>
          <p className="text-[11px] text-slate-500 leading-normal">
            Runs 100% locally in your browser. No backend server, no login, and no data leaves your device.
          </p>
        </div>
      </div>

      {/* Quick Launch Buttons */}
      <div className="pt-2">
        <span className="text-xs font-semibold text-slate-700 block mb-3">
          Click an example to test the engine instantly:
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 text-xs font-medium transition-all shadow-2xs flex items-center space-x-1.5"
            >
              <span>{preset.title}</span>
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

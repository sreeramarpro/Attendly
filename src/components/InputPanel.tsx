import {
  BookOpen,
  CornerDownLeft,
  FileSpreadsheet,
  RotateCcw,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { SAMPLE_PRESETS, type SamplePreset } from '../data/samplePresets.js';

interface InputPanelProps {
  inputText: string;
  setInputText: (val: string) => void;
  onCalculate: () => void;
  onClear: () => void;
  isProcessing: boolean;
  detectedFormat?: string;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  inputText,
  setInputText,
  onCalculate,
  onClear,
  isProcessing,
  detectedFormat,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard shortcut Ctrl+Enter or Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onCalculate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCalculate]);

  const handleSelectPreset = (preset: SamplePreset) => {
    setInputText(preset.text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 mb-6">
      {/* Top Bar with title and presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
            <span>Input Attendance Data</span>
            {detectedFormat && detectedFormat !== 'empty' && (
              <span className="text-[11px] font-normal uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Format: {detectedFormat.replace('_', ' ')}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Paste an ERP table, type in ordinary English, or write in shorthand. Any combination is welcome.
          </p>
        </div>

        {/* Quick sample presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center">
            <BookOpen className="w-3 h-3 mr-1" /> Try sample:
          </span>
          {SAMPLE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors font-medium flex items-center space-x-1"
              title={p.description}
            >
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={6}
          placeholder={`Paste or type any attendance information here...\n\nSupported examples:\n• "ASE lecture 26 attended out of 28 and practical 16 out of 24. PDC theory 18/20, lab 16 attended from 22"\n• "ASE L 26 28 P 16 24, deep learning lecture 31 out of 34 and practical 12/24"\n• Raw tabular data copied from your university portal table (tabs, pipes, or columns)\n• "For Adaptive Software Engineering, I attended 26 of 28 lectures. Missed 2 classes."`}
          className="w-full rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 p-4 text-sm text-slate-800 placeholder-slate-400 font-mono resize-y leading-relaxed transition-all outline-none"
        />

        {inputText && (
          <div className="absolute bottom-3 right-3 text-[11px] text-slate-400 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-200">
            {inputText.split('\n').length} lines • {inputText.length} chars
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center space-x-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Supports dozens to hundreds of subjects. Press</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 border border-slate-200 rounded text-slate-600">
            Ctrl + Enter
          </kbd>
          <span>to calculate.</span>
        </div>

        <div className="flex items-center space-x-2">
          {inputText && (
            <button
              type="button"
              onClick={onClear}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800 text-xs font-medium transition-colors flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCalculate}
            disabled={isProcessing || !inputText.trim()}
            className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm shadow-indigo-200 transition-all flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Interpreting...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Calculate Attendance</span>
                <CornerDownLeft className="w-3 h-3 opacity-60 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

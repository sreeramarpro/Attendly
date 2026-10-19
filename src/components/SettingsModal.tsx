import { RotateCcw, Sliders, X } from 'lucide-react';
import React, { useState } from 'react';
import {
  DEFAULT_WEIGHTS,
  type CalculationMethod,
  type CalculationSettings,
  type ComponentWeights,
} from '../types/attendance.js';

interface SettingsModalProps {
  settings: CalculationSettings;
  onSave: (newSettings: CalculationSettings) => void;
  onReset: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSave,
  onReset,
  onClose,
}) => {
  const [method, setMethod] = useState<CalculationMethod>(settings.method);
  const [weights, setWeights] = useState<ComponentWeights>({ ...settings.weights });
  const [targetPercentage, setTargetPercentage] = useState<number>(
    settings.targetPercentage ?? 75
  );

  const handleWeightChange = (key: keyof ComponentWeights, val: string) => {
    const num = parseFloat(val);
    setWeights((prev) => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      method,
      weights,
      targetPercentage,
    });
    onClose();
  };

  const handleReset = () => {
    onReset();
    setMethod('raw-count');
    setWeights(DEFAULT_WEIGHTS);
    setTargetPercentage(75);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Calculation Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs text-slate-700">
          {/* Calculation Method */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Attendance Calculation Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  method === 'raw-count'
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="calcMethod"
                    value="raw-count"
                    checked={method === 'raw-count'}
                    onChange={() => setMethod('raw-count')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-900">Raw-Count Weighted</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 pl-5">
                  Standard university method: weights applied to both attended and conducted counts.
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  method === 'erp-percentage'
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="calcMethod"
                    value="erp-percentage"
                    checked={method === 'erp-percentage'}
                    onChange={() => setMethod('erp-percentage')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-900">ERP-Percentage</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 pl-5">
                  Multiplies component percentages by weight and divides by sum of weights.
                </p>
              </label>
            </div>
          </div>

          {/* Component Weights */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-900">
                Default Component Weights
              </label>
              <span className="text-[11px] text-slate-500">Affects overall ratio</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Lecture (L)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={weights.lecture}
                  onChange={(e) => handleWeightChange('lecture', e.target.value)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Tutorial (T)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={weights.tutorial}
                  onChange={(e) => handleWeightChange('tutorial', e.target.value)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Practical (P)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={weights.practical}
                  onChange={(e) => handleWeightChange('practical', e.target.value)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Skill (S)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={weights.skill}
                  onChange={(e) => handleWeightChange('skill', e.target.value)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Target Attendance Threshold */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Target Attendance Threshold (%)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Used to calculate how many classes you need to attend or can safely miss.
            </p>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="0"
                max="100"
                value={targetPercentage}
                onChange={(e) => setTargetPercentage(parseInt(e.target.value, 10) || 0)}
                className="w-24 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:border-indigo-500 outline-none"
              />
              <span className="text-xs text-slate-500">% target (e.g. 75% or 85%)</span>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl border border-slate-200 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

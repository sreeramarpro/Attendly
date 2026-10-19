import { Calculator, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import React from 'react';

interface HeaderProps {
  onOpenSettings: () => void;
  activeMethod: 'raw-count' | 'erp-percentage';
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, activeMethod }) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Attendly</h1>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">ERP Attendance Calculator</p>
          </div>
        </div>

        {/* Local privacy badge & settings button */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">100% Private • Local Browser Calculation</span>
          </div>

          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors text-xs font-medium shadow-sm"
            title="Configure weights, method, and targets"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Settings</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-mono">
              {activeMethod === 'raw-count' ? 'Raw-Count' : 'ERP-%'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

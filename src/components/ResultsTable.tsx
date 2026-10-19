import {
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Share2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { exportToCSV, exportToTSV, formatAllSubjectsText } from '../engine/exporter.js';
import type { SubjectCalculation } from '../types/attendance.js';
import { SubjectRow } from './SubjectRow.js';

interface ResultsTableProps {
  calculations: SubjectCalculation[];
  targetPercentage?: number;
  onEditSubject: (subjectId: string) => void;
  onAddNewSubject: () => void;
  onShowToast: (msg: string) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  calculations,
  targetPercentage = 75,
  onEditSubject,
  onAddNewSubject,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'above' | 'below' | 'warnings'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'pct_desc' | 'pct_asc'>('name_asc');

  // Filter & Sort Logic
  const filteredCalculations = useMemo(() => {
    let result = [...calculations];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (sub) =>
          sub.subjectName.toLowerCase().includes(q) ||
          (sub.subjectCode && sub.subjectCode.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filterType === 'above') {
      result = result.filter((sub) => sub.overallPercentage !== null && sub.overallPercentage >= targetPercentage);
    } else if (filterType === 'below') {
      result = result.filter((sub) => sub.overallPercentage !== null && sub.overallPercentage < targetPercentage);
    } else if (filterType === 'warnings') {
      result = result.filter((sub) => sub.hasWarnings || !sub.isValid);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.subjectName.localeCompare(b.subjectName);
      }
      if (sortBy === 'name_desc') {
        return b.subjectName.localeCompare(a.subjectName);
      }
      if (sortBy === 'pct_desc') {
        const pctA = a.overallPercentage ?? -1;
        const pctB = b.overallPercentage ?? -1;
        return pctB - pctA;
      }
      if (sortBy === 'pct_asc') {
        const pctA = a.overallPercentage ?? 999;
        const pctB = b.overallPercentage ?? 999;
        return pctA - pctB;
      }
      return 0;
    });

    return result;
  }, [calculations, searchQuery, filterType, sortBy, targetPercentage]);

  // Copy All Report
  const handleCopyAll = () => {
    const text = formatAllSubjectsText(calculations);
    navigator.clipboard.writeText(text);
    onShowToast('Copied full attendance summary to clipboard');
  };

  // Copy for Excel (TSV)
  const handleCopyTSV = () => {
    const tsv = exportToTSV(calculations);
    navigator.clipboard.writeText(tsv);
    onShowToast('Copied TSV format (ready to paste into Excel)');
  };

  // Download CSV
  const handleDownloadCSV = () => {
    const csv = exportToCSV(calculations);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendly-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('CSV file downloaded successfully');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 mb-8">
      {/* Header with Search, Filter & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">Calculated Attendance Results</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing {filteredCalculations.length} of {calculations.length} subjects
          </p>
        </div>

        {/* Global Export & Add Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddNewSubject}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center space-x-1.5 shadow-xs"
            title="Copy human-readable summary"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy Text</span>
          </button>

          <button
            type="button"
            onClick={handleCopyTSV}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center space-x-1.5 shadow-xs"
            title="Copy Tab-Separated Values for Excel/Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel (TSV)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-medium flex items-center space-x-1.5 shadow-xs"
            title="Download CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by subject or course code..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('above')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'above' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              &gt;={targetPercentage}%
            </button>
            <button
              onClick={() => setFilterType('below')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'below' ? 'bg-white text-rose-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              &lt;{targetPercentage}%
            </button>
            <button
              onClick={() => setFilterType('warnings')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'warnings' ? 'bg-white text-amber-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Issues
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-medium text-slate-700 focus:border-indigo-500 outline-none"
            >
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="pct_desc">Attendance % (High to Low)</option>
              <option value="pct_asc">Attendance % (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rows Container */}
      <div className="mt-2">
        {filteredCalculations.length > 0 ? (
          filteredCalculations.map((subCalc) => (
            <SubjectRow
              key={subCalc.subjectId}
              calculation={subCalc}
              targetPercentage={targetPercentage}
              onEdit={onEditSubject}
              onShowToast={onShowToast}
            />
          ))
        ) : (
          <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500">No subjects match your search or filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

import {
  AlertCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { calculateSubject } from '../engine/calculator.js';
import { formatComponentName } from '../engine/componentDetector.js';
import { validateComponent } from '../engine/validator.js';
import type {
  CalculationSettings,
  ComponentRecord,
  ComponentType,
  SubjectRecord,
} from '../types/attendance.js';

interface SubjectEditModalProps {
  subject: SubjectRecord;
  settings: CalculationSettings;
  onSave: (updatedSubject: SubjectRecord) => void;
  onDeleteSubject: (subjectId: string) => void;
  onClose: () => void;
}

export const SubjectEditModal: React.FC<SubjectEditModalProps> = ({
  subject,
  settings,
  onSave,
  onDeleteSubject,
  onClose,
}) => {
  const [name, setName] = useState(subject.name);
  const [code, setCode] = useState(subject.code ?? '');
  const [components, setComponents] = useState<ComponentRecord[]>([
    ...subject.components.map((c) => ({ ...c })),
  ]);

  // Live recalculation for instant user feedback
  const draftSubject: SubjectRecord = {
    ...subject,
    name,
    code: code.trim() || undefined,
    components,
  };
  const liveCalc = calculateSubject(draftSubject, settings);

  const handleUpdateComponent = (
    index: number,
    field: keyof ComponentRecord,
    val: any
  ) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };

      if (field === 'absent') {
        copy[index].isAbsentDerived = false;
      }

      // If user updates attended or conducted, and absent was originally derived or null, keep absent in sync
      if (field === 'attended' || field === 'conducted') {
        const att = field === 'attended' ? val : copy[index].attended;
        const cond = field === 'conducted' ? val : copy[index].conducted;
        if (copy[index].isAbsentDerived || copy[index].absent === null) {
          if (att !== null && cond !== null && cond >= att) {
            copy[index].absent = cond - att;
            copy[index].isAbsentDerived = true;
          }
        }
      }

      // If component type changed, update name and default weight if not custom
      if (field === 'type') {
        copy[index].name = formatComponentName(val as ComponentType);
        copy[index].weight = settings.weights[val as ComponentType] ?? 1.0;
      }

      // Re-run validation immediately on edited component
      validateComponent(copy[index]);

      return copy;
    });
  };

  const handleAddComponent = () => {
    const newComp: ComponentRecord = {
      id: `comp-new-${Date.now()}`,
      type: 'lecture',
      name: 'Lecture',
      attended: 0,
      conducted: 0,
      absent: 0,
      weight: settings.weights.lecture ?? 1.0,
      confidence: 'high',
      isManual: true,
      validationStatus: 'valid',
    };
    setComponents((prev) => [...prev, newComp]);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draftSubject);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Review & Edit Subject</h3>
            <p className="text-xs text-slate-500">Correct detected counts or add missing components</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Subject Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Code (Optional)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CS301"
                className="w-full text-xs font-mono uppercase rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>
          </div>

          {/* Components Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Attendance Components ({components.length})
              </label>
              <button
                type="button"
                onClick={handleAddComponent}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Component</span>
              </button>
            </div>

            {components.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs text-slate-500 mb-2">No components yet.</p>
                <button
                  type="button"
                  onClick={handleAddComponent}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50"
                >
                  Add Lecture / Practical
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {components.map((comp, idx) => {
                  const validation = validateComponent(comp);
                  const isInvalid = validation.status === 'invalid';

                  return (
                    <div
                      key={comp.id}
                      className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-colors ${
                        isInvalid ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 bg-slate-50/60'
                      }`}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                            Type
                          </label>
                          <select
                            value={comp.type}
                            onChange={(e) =>
                              handleUpdateComponent(idx, 'type', e.target.value as ComponentType)
                            }
                            className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 outline-none"
                          >
                            <option value="lecture">Lecture (L)</option>
                            <option value="practical">Practical (P)</option>
                            <option value="tutorial">Tutorial (T)</option>
                            <option value="skill">Skill (S)</option>
                            <option value="general">General</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                            Attended
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={comp.attended ?? ''}
                            onChange={(e) =>
                              handleUpdateComponent(
                                idx,
                                'attended',
                                e.target.value === '' ? null : parseInt(e.target.value, 10)
                              )
                            }
                            className={`w-full text-xs rounded-lg border bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 outline-none font-mono ${
                              isInvalid ? 'border-rose-300' : 'border-slate-200'
                            }`}
                            placeholder="e.g. 26"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                            Conducted
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={comp.conducted ?? ''}
                            onChange={(e) =>
                              handleUpdateComponent(
                                idx,
                                'conducted',
                                e.target.value === '' ? null : parseInt(e.target.value, 10)
                              )
                            }
                            className={`w-full text-xs rounded-lg border bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 outline-none font-mono ${
                              isInvalid ? 'border-rose-300' : 'border-slate-200'
                            }`}
                            placeholder="e.g. 28"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                            Absent
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={comp.absent ?? ''}
                            onChange={(e) =>
                              handleUpdateComponent(
                                idx,
                                'absent',
                                e.target.value === '' ? null : parseInt(e.target.value, 10)
                              )
                            }
                            className={`w-full text-xs rounded-lg border bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 outline-none font-mono ${
                              isInvalid ? 'border-rose-300' : 'border-slate-200'
                            }`}
                            placeholder="e.g. 2"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                              Weight
                            </label>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="5"
                              value={comp.weight}
                              onChange={(e) =>
                                handleUpdateComponent(idx, 'weight', parseFloat(e.target.value) || 0)
                              }
                              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 outline-none font-mono"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(idx)}
                            className="mt-4 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove component"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Explicit Error Reason */}
                      {isInvalid && validation.reason && (
                        <div className="text-[11px] text-rose-600 flex items-center space-x-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{validation.reason}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Recalculation Preview Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-indigo-950">Live Attendance Preview: </span>
              <span className="text-slate-600 ml-1">
                Weighted {liveCalc.totalWeightedAttended.toFixed(1)} / {liveCalc.totalWeightedConducted.toFixed(1)}
              </span>
              {liveCalc.statusMessage && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                  {liveCalc.statusMessage}
                </span>
              )}
            </div>
            <div className="text-base font-extrabold text-indigo-700">
              {liveCalc.formattedPercentage}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete ${subject.name}?`)) {
                onDeleteSubject(subject.id);
              }
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center space-x-1 px-2 py-1 rounded hover:bg-rose-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Subject</span>
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
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

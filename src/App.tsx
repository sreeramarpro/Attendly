import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from './components/EmptyState.js';
import { Header } from './components/Header.js';
import { InputPanel } from './components/InputPanel.js';
import { InteractionCard } from './components/InteractionCard.js';
import { MergeSuggestionsPanel } from './components/MergeSuggestionsPanel.js';
import { ResultsTable } from './components/ResultsTable.js';
import { SettingsModal } from './components/SettingsModal.js';
import { SubjectEditModal } from './components/SubjectEditModal.js';
import { SummaryCards } from './components/SummaryCards.js';
import { Toast } from './components/Toast.js';
import { WarningsPanel } from './components/WarningsPanel.js';
import type { SamplePreset } from './data/samplePresets.js';
import { calculateOverallSummary } from './engine/calculator.js';
import { processAttendanceInput } from './engine/pipeline.js';
import { validateSubject } from './engine/validator.js';
import { useAttendanceSettings } from './hooks/useAttendanceSettings.js';
import type {
  MergeSuggestion,
  ParsingWarning,
  ProjectionResult,
  QuestionResult,
  SubjectRecord,
} from './types/attendance.js';

export function App() {
  const { settings, setSettings, resetToDefaults } = useAttendanceSettings();

  const [inputText, setInputText] = useState('');
  const [isCalculated, setIsCalculated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string>('empty');

  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [warnings, setWarnings] = useState<ParsingWarning[]>([]);
  const [mergeSuggestions, setMergeSuggestions] = useState<MergeSuggestion[]>([]);
  const [questionResult, setQuestionResult] = useState<QuestionResult | undefined>(undefined);
  const [projectionResult, setProjectionResult] = useState<ProjectionResult | undefined>(undefined);
  const [clarificationPrompt, setClarificationPrompt] = useState<string | undefined>(undefined);

  // Modals and Toasts
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  // Run calculation
  const handleCalculate = useCallback(() => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setTimeout(() => {
      try {
        const result = processAttendanceInput(inputText, settings, subjects);

        if (result.intent === 'question' || result.intent === 'attendance_question') {
          setQuestionResult(result.questionResult);
          setProjectionResult(undefined);
          setClarificationPrompt(undefined);
          setIsCalculated(true);
          showToast(result.questionResult?.hasData ? 'Query answered' : 'Notice: No attendance records');
        } else if (result.intent === 'projection') {
          setProjectionResult(result.projectionResult);
          setQuestionResult(undefined);
          setClarificationPrompt(undefined);
          setIsCalculated(true);
          showToast('Projection calculated');
        } else if (result.intent === 'conversational') {
          setClarificationPrompt(result.clarificationPrompt || result.conversationalMessage);
          // Non-negotiable Rule 5: Never create a subject or mutate attendance state from non-attendance statements
          setWarnings(result.warnings);
          setQuestionResult(undefined);
          setProjectionResult(undefined);
          setIsCalculated(true);
          showToast('No attendance data detected in input.');
        } else if (result.intent === 'ambiguous') {
          setClarificationPrompt(result.clarificationPrompt);
          // Non-negotiable Rule 5: Never mutate attendance state from ambiguous input
          setWarnings(result.warnings);
          setQuestionResult(undefined);
          setProjectionResult(undefined);
          setIsCalculated(true);
          showToast('Input is ambiguous. Please clarify.');
        } else {
          // Actionable attendance_data or erp_table
          setClarificationPrompt(undefined);
          setSubjects(result.subjects);
          setWarnings(result.warnings);
          setMergeSuggestions(result.mergeSuggestions);
          setDetectedFormat(result.detectedFormat);
          setQuestionResult(undefined);
          setProjectionResult(undefined);
          setIsCalculated(true);
          showToast(`Analyzed ${result.subjects.length} subjects successfully`);
        }
      } catch {
        showToast('Error calculating attendance. Please review your input.');
      } finally {
        setIsProcessing(false);
      }
    }, 20);
  }, [inputText, settings, showToast, subjects]);

  const handleClear = () => {
    setInputText('');
    setSubjects([]);
    setWarnings([]);
    setMergeSuggestions([]);
    setQuestionResult(undefined);
    setProjectionResult(undefined);
    setClarificationPrompt(undefined);
    setIsCalculated(false);
    setDetectedFormat('empty');
  };

  const handleSelectPreset = (preset: SamplePreset) => {
    setInputText(preset.text);
    // Trigger calculation automatically on sample select
    setIsProcessing(true);
    setTimeout(() => {
      const result = processAttendanceInput(preset.text, settings, []);
      setSubjects(result.subjects);
      setWarnings(result.warnings);
      setMergeSuggestions(result.mergeSuggestions);
      setDetectedFormat(result.detectedFormat);
      setQuestionResult(undefined);
      setProjectionResult(undefined);
      setIsCalculated(true);
      setIsProcessing(false);
      showToast(`Loaded ${preset.title} with ${result.subjects.length} subjects`);
    }, 20);
  };

  // Re-calculate overall summary whenever subjects or settings change
  const overallSummary = useMemo(() => {
    return calculateOverallSummary(subjects, settings, warnings, mergeSuggestions);
  }, [subjects, settings, warnings, mergeSuggestions]);

  // Merge suggestion confirmation
  const handleConfirmMerge = (suggestion: MergeSuggestion) => {
    const subA = subjects.find((s) => s.id === suggestion.subjectAId);
    const subB = subjects.find((s) => s.id === suggestion.subjectBId);

    if (!subA || !subB) return;

    // Merge components of subA into subB
    const combinedComponents = [...subB.components];
    for (const compA of subA.components) {
      if (!combinedComponents.some((c) => c.type === compA.type)) {
        combinedComponents.push(compA);
      }
    }

    const updatedB: SubjectRecord = {
      ...subB,
      components: combinedComponents,
      code: subB.code || subA.code,
    };

    setSubjects((prev) => prev.filter((s) => s.id !== subA.id).map((s) => (s.id === subB.id ? updatedB : s)));
    setMergeSuggestions((prev) => prev.filter((m) => m.id !== suggestion.id));
    setWarnings((prev) =>
      prev.filter(
        (w) => w.subjectId !== subA.id && w.subjectName?.toLowerCase() !== subA.name.toLowerCase()
      )
    );
    showToast(`Merged "${subA.name}" into "${subB.name}"`);
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setMergeSuggestions((prev) => prev.filter((m) => m.id !== suggestionId));
  };

  // Manual Editing Handlers
  const handleOpenEditSubjectById = (subjectId: string) => {
    const target = subjects.find((s) => s.id === subjectId);
    if (target) {
      setEditingSubject(target);
    }
  };

  const handleOpenEditSubjectByName = (subjectName: string) => {
    const target = subjects.find(
      (s) => s.name.toLowerCase() === subjectName.toLowerCase() || s.code === subjectName
    );
    if (target) {
      setEditingSubject(target);
    }
  };

  const handleSaveSubject = (updated: SubjectRecord) => {
    setSubjects((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      if (exists) {
        return prev.map((s) => (s.id === updated.id ? updated : s));
      } else {
        return [...prev, updated];
      }
    });

    // Revalidate updated subject so resolved warnings are cleared from the warnings panel
    const validation = validateSubject(updated);
    setWarnings((prev) => {
      const remaining = prev.filter(
        (w) => w.subjectId !== updated.id && w.subjectName?.toLowerCase() !== updated.name.toLowerCase()
      );
      return [...remaining, ...validation.warnings];
    });

    setEditingSubject(null);
    showToast(`Saved updates for "${updated.name}"`);
  };

  const handleDeleteSubject = (subjectId: string) => {
    const target = subjects.find((s) => s.id === subjectId);
    setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
    setWarnings((prev) =>
      prev.filter(
        (w) => w.subjectId !== subjectId && (target ? w.subjectName?.toLowerCase() !== target.name.toLowerCase() : true)
      )
    );
    setMergeSuggestions((prev) =>
      prev.filter((m) => m.subjectAId !== subjectId && m.subjectBId !== subjectId)
    );
    setEditingSubject(null);
    showToast('Subject removed');
  };

  const handleAddNewSubject = () => {
    const newSub: SubjectRecord = {
      id: `subj-manual-${Date.now()}`,
      name: `New Subject ${subjects.length + 1}`,
      components: [
        {
          id: `comp-man-${Date.now()}`,
          type: 'lecture',
          name: 'Lecture',
          attended: 0,
          conducted: 0,
          absent: 0,
          weight: settings.weights.lecture ?? 1.0,
          confidence: 'high',
          isManual: true,
        },
      ],
      isPartial: false,
    };
    setEditingSubject(newSub);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* App Header */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} activeMethod={settings.method} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Panel */}
        <InputPanel
          inputText={inputText}
          setInputText={setInputText}
          onCalculate={handleCalculate}
          onClear={handleClear}
          isProcessing={isProcessing}
          detectedFormat={detectedFormat}
        />

        {/* Interaction Card (Questions / Projections / Ambiguity) */}
        {(questionResult || projectionResult || clarificationPrompt) && (
          <div className="mt-6">
            <InteractionCard
              questionResult={questionResult}
              projectionResult={projectionResult}
              ambiguousPrompt={clarificationPrompt}
              onDismiss={() => {
                setQuestionResult(undefined);
                setProjectionResult(undefined);
                setClarificationPrompt(undefined);
              }}
            />
          </div>
        )}

        {/* Warnings Section (displayed whenever warnings exist) */}
        {warnings.length > 0 && (
          <div className="mt-6">
            <WarningsPanel
              warnings={warnings}
              onOpenEditSubject={handleOpenEditSubjectByName}
            />
          </div>
        )}

        {/* Calculated Results View */}
        {isCalculated && subjects.length > 0 ? (
          <div className="space-y-6 mt-6">
            {/* Merge Suggestions */}
            <MergeSuggestionsPanel
              suggestions={mergeSuggestions}
              onConfirmMerge={handleConfirmMerge}
              onDismissSuggestion={handleDismissSuggestion}
            />

            {/* Summary Cards */}
            <SummaryCards summary={overallSummary} targetPercentage={settings.targetPercentage} />

            {/* Results Table */}
            <ResultsTable
              calculations={overallSummary.subjectCalculations}
              targetPercentage={settings.targetPercentage}
              onEditSubject={handleOpenEditSubjectById}
              onAddNewSubject={handleAddNewSubject}
              onShowToast={showToast}
            />
          </div>
        ) : !questionResult && !projectionResult && !clarificationPrompt && warnings.length === 0 ? (
          /* Empty State when no calculation has taken place */
          <EmptyState onSelectPreset={handleSelectPreset} />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong className="text-slate-800 font-semibold">Attendly</strong> • Intelligent ERP Attendance Calculator
          </div>
          <div className="text-slate-400">
            Local browser calculations • Default weights: Lecture (1.0), Tutorial (1.0), Practical (0.5), Skill (0.25)
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            showToast('Updated calculation settings');
          }}
          onReset={() => {
            resetToDefaults();
            showToast('Reset settings to default weights');
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Subject Edit Modal */}
      {editingSubject && (
        <SubjectEditModal
          subject={editingSubject}
          settings={settings}
          onSave={handleSaveSubject}
          onDeleteSubject={handleDeleteSubject}
          onClose={() => setEditingSubject(null)}
        />
      )}

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}

export default App;

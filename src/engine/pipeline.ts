import type {
  CalculationSettings,
  OverallCalculationSummary,
  ParseResult,
  ParsingWarning,
  SubjectRecord,
} from '../types/attendance.js';
import { calculateOverallSummary } from './calculator.js';
import {
  isStructuredERPRegister,
  parseStructuredERPRegister,
} from './erpTableParser.js';
import { classifyInputIntent } from './intentClassifier.js';
import { mergeSubjectsSafely } from './merger.js';
import { parseNaturalLanguageInput } from './naturalLanguageParser.js';
import { normalizeInputText } from './normalizer.js';
import {
  handleAttendanceProjection,
  handleAttendanceQuestion,
} from './projectionEngine.js';
import { detectTableStructure, parseTableRows } from './tableDetector.js';
import { validateSubjectRecords } from './validator.js';

/**
 * Main attendance parsing pipeline.
 * Routes inputs using dedicated interpretation strategies:
 * - Intent Classification: questions & projections do not pollute subjects
 * - Strategy A: Structured ERP tables (handles wrapped lines, multiline columns, academic years)
 * - Strategy B: Free-form natural language and shorthand
 */
export function processAttendanceInput(
  rawInput: string,
  settings: CalculationSettings,
  existingSubjects: SubjectRecord[] = []
): ParseResult {
  const normalized = normalizeInputText(rawInput);
  if (!normalized.trim()) {
    return {
      subjects: existingSubjects,
      warnings: validateSubjectRecords(existingSubjects),
      mergeSuggestions: [],
      rawInput,
      detectedFormat: 'empty',
      intent: 'empty',
    };
  }

  const intent = classifyInputIntent(normalized);

  // Intent: Question about attendance (e.g. "What is my attendance?")
  if (intent === 'question' || intent === 'attendance_question') {
    const questionResult = handleAttendanceQuestion(normalized, existingSubjects, settings);
    return {
      subjects: existingSubjects,
      warnings: validateSubjectRecords(existingSubjects),
      mergeSuggestions: [],
      rawInput,
      detectedFormat: 'natural_language',
      intent: 'question',
      questionResult,
    };
  }

  // Intent: Projection or simulation (e.g. "What happens if I skip 2 lectures?", "How many consecutive classes to reach 85%?")
  if (intent === 'projection') {
    const projectionResult = handleAttendanceProjection(normalized, existingSubjects, settings);
    return {
      subjects: existingSubjects,
      warnings: validateSubjectRecords(existingSubjects),
      mergeSuggestions: [],
      rawInput,
      detectedFormat: 'natural_language',
      intent,
      projectionResult,
    };
  }

  // Intent: Conversational input (e.g. "My target is 85% and Physics is my hardest subject.")
  if (intent === 'conversational') {
    const conversationalMsg =
      'No actionable attendance data detected. To calculate your attendance, please enter records such as "Physics: 24/30" or paste an attendance table.';
    return {
      subjects: existingSubjects,
      warnings: validateSubjectRecords(existingSubjects),
      mergeSuggestions: [],
      rawInput,
      detectedFormat: 'natural_language',
      intent: 'conversational',
      conversationalMessage: conversationalMsg,
      clarificationPrompt: conversationalMsg,
    };
  }

  // Intent: Ambiguous input with insufficient or conflicting information (e.g. "Networks: 20, 18, 2" or "I missed 5 lec n 7 prac")
  if (intent === 'ambiguous') {
    let clarificationMsg = '';
    if (/\b(?:missed|bunked|skipped|absent)\b/i.test(normalized)) {
      clarificationMsg = 'Which subject do these absences belong to, and how many classes were conducted (are the total conducted classes known)?';
    } else {
      const numbersMatch = normalized.match(/\b\d+\b/g);
      const numbersStr = numbersMatch ? numbersMatch.join(', ') : '';
      clarificationMsg = `What do the numbers (${numbersStr}) represent? Please specify which value is attended, conducted, and absent.`;
    }

    const warning: ParsingWarning = {
      id: `warn-ambig-${Date.now()}`,
      type: 'ambiguous_values',
      message: clarificationMsg,
      snippet: normalized,
      suggestedAction: clarificationMsg,
      resolvable: true,
    };

    return {
      subjects: existingSubjects,
      warnings: [warning, ...validateSubjectRecords(existingSubjects)],
      mergeSuggestions: [],
      rawInput,
      detectedFormat: 'natural_language',
      intent,
      isAmbiguous: true,
      clarificationPrompt: clarificationMsg,
    };
  }

  const allSubjects: SubjectRecord[] = [];
  const pipelineWarnings: ParsingWarning[] = [];
  let detectedFormat: ParseResult['detectedFormat'] = 'natural_language';

  // Strategy A1: Check for structured ERP register (e.g. S.No CourseCode CourseDescription LTPS ... Conducted Attended Absent ...)
  if (isStructuredERPRegister(normalized)) {
    detectedFormat = 'table';
    const erpResult = parseStructuredERPRegister(normalized, settings.weights);

    if (erpResult.subjects.length > 0) {
      allSubjects.push(...erpResult.subjects);
      pipelineWarnings.push(...erpResult.warnings);

      // Check if there are separate non-table notes before or after the table
      if (erpResult.tableRange) {
        const textBefore = normalized.substring(0, erpResult.tableRange.start).trim();
        const textAfter = normalized.substring(erpResult.tableRange.end).trim();

        const hasAttendanceProse = (txt: string) => {
          if (!txt || txt.length < 5) return false;
          const hasSlashRatio = /\b\d+\/\d+\b/.test(txt);
          const hasOutOf = /\b\d+\s+(?:attended\s+)?out\s+of\s+\d+\b/i.test(txt);
          const hasAttendedConducted = /\b(?:attended|went\s+to|present)\s+\d+\b/i.test(txt);
          const isBanner = /^(?:academic\s+year|student\s+attendance|printed\s+on|attendance\s+report|faculty\s*:)/i.test(txt);
          return (hasSlashRatio || hasOutOf || hasAttendedConducted) && !isBanner;
        };

        if (hasAttendanceProse(textBefore)) {
          detectedFormat = 'mixed';
          const nlBefore = parseNaturalLanguageInput(textBefore, settings.weights);
          allSubjects.push(...nlBefore.subjects);
          pipelineWarnings.push(...nlBefore.warnings);
        }

        if (hasAttendanceProse(textAfter)) {
          detectedFormat = 'mixed';
          const nlAfter = parseNaturalLanguageInput(textAfter, settings.weights);
          allSubjects.push(...nlAfter.subjects);
          pipelineWarnings.push(...nlAfter.warnings);
        }
      }
    }
  }

  // Strategy A2: If not an ERP register, check for traditional tab/pipe-delimited table
  if (allSubjects.length === 0) {
    const lines = normalized.split('\n');
    const tableDetection = detectTableStructure(lines);

    if (tableDetection.isTable) {
      detectedFormat = 'table';
      const { subjects: tableSubjects, consumedLineIndices } = parseTableRows(
        lines,
        tableDetection.headerRowIndex,
        tableDetection.mapping,
        settings.weights
      );
      allSubjects.push(...tableSubjects);

      // Remaining non-table lines: only parse if they are actual natural language attendance sentences
      const remainingLines = lines
        .filter((_, idx) => !consumedLineIndices.has(idx))
        .filter((line) => {
          const trimmed = line.trim();
          if (!trimmed) return false;
          return (
            /\b\d+\/\d+\b/.test(trimmed) ||
            /\b\d+\s+out\s+of\s+\d+\b/i.test(trimmed) ||
            /\b(?:attended|went\s+to|present)\s+\d+\b/i.test(trimmed)
          );
        })
        .join('\n')
        .trim();

      if (remainingLines) {
        detectedFormat = 'mixed';
        const { subjects: nlSubjects, warnings: nlWarnings } = parseNaturalLanguageInput(
          remainingLines,
          settings.weights
        );
        allSubjects.push(...nlSubjects);
        pipelineWarnings.push(...nlWarnings);
      }
    }
  }

  // Strategy B: Free-form natural language or shorthand (if no table was matched)
  if (allSubjects.length === 0) {
    if (/\b[LTPS]\s+\d+\s+\d+\b/.test(normalized)) {
      detectedFormat = 'shorthand';
    }
    const { subjects: nlSubjects, warnings: nlWarnings } = parseNaturalLanguageInput(
      normalized,
      settings.weights
    );
    allSubjects.push(...nlSubjects);
    pipelineWarnings.push(...nlWarnings);
  }

  // If no actionable attendance data was detected after parsing
  if (allSubjects.length === 0) {
    const conversationalMsg =
      'No actionable attendance data detected. Please enter records such as "Physics: 24/30" or paste an attendance table.';
    return {
      subjects: existingSubjects,
      warnings: validateSubjectRecords(existingSubjects),
      mergeSuggestions: [],
      rawInput,
      detectedFormat,
      intent: 'conversational',
      conversationalMessage: conversationalMsg,
      clarificationPrompt: conversationalMsg,
    };
  }

  // Step 2: Merge repeated subject mentions safely, including existing subjects
  const clonedExisting: SubjectRecord[] = existingSubjects.map((s) => ({
    ...s,
    components: s.components.map((c) => ({ ...c })),
  }));
  const subjectsToMerge = clonedExisting.length > 0 ? [...clonedExisting, ...allSubjects] : allSubjects;

  const { mergedSubjects, warnings: mergeWarnings, mergeSuggestions } = mergeSubjectsSafely(subjectsToMerge);
  pipelineWarnings.push(...mergeWarnings);

  // Step 3: Run comprehensive validation on records
  const validationWarnings = validateSubjectRecords(mergedSubjects);
  pipelineWarnings.push(...validationWarnings);

  // Deduplicate warnings by message + subject
  const seenWarnings = new Set<string>();
  const uniqueWarnings: ParsingWarning[] = [];
  for (const w of pipelineWarnings) {
    const key = `${w.type}::${w.subjectName ?? ''}::${w.message}`;
    if (!seenWarnings.has(key)) {
      seenWarnings.add(key);
      uniqueWarnings.push(w);
    }
  }

  return {
    subjects: mergedSubjects,
    warnings: uniqueWarnings,
    mergeSuggestions,
    rawInput,
    detectedFormat,
    intent,
  };
}

/**
 * Convenience helper to run parsing and calculation in one pass.
 */
export function parseAndCalculate(
  rawInput: string,
  settings: CalculationSettings,
  existingSubjects: SubjectRecord[] = []
): {
  parseResult: ParseResult;
  summary: OverallCalculationSummary;
} {
  const parseResult = processAttendanceInput(rawInput, settings, existingSubjects);
  const summary = calculateOverallSummary(
    parseResult.subjects,
    settings,
    parseResult.warnings,
    parseResult.mergeSuggestions
  );

  if (parseResult.intent) summary.intent = parseResult.intent;
  if (parseResult.questionResult) summary.questionResult = parseResult.questionResult;
  if (parseResult.projectionResult) summary.projectionResult = parseResult.projectionResult;
  if (parseResult.clarificationPrompt) summary.clarificationPrompt = parseResult.clarificationPrompt;
  if (parseResult.conversationalMessage) summary.conversationalMessage = parseResult.conversationalMessage;

  return { parseResult, summary };
}

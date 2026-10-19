import type {
  CalculationSettings,
  ProjectionResult,
  QuestionResult,
  SubjectRecord,
} from '../types/attendance.js';
import { calculateOverallSummary } from './calculator.js';

/**
 * Handles question inputs such as "What is my attendance?" or "Calculate my attendance".
 */
export function handleAttendanceQuestion(
  _text: string,
  existingSubjects: SubjectRecord[],
  settings: CalculationSettings
): QuestionResult {
  if (existingSubjects.length === 0) {
    return {
      isQuestion: true,
      hasData: false,
      message: 'No attendance data recorded yet. Please enter your attendance or paste an ERP table to calculate.',
    };
  }

  const summary = calculateOverallSummary(existingSubjects, settings, [], []);
  if (summary.validComponentsCount === 0 || summary.grandOverallPercentage === null) {
    return {
      isQuestion: true,
      hasData: false,
      message: 'Attendance data contains invalid or contradictory records. Overall attendance cannot be verified until invalid records are corrected.',
    };
  }

  let note = '';
  if (summary.invalidComponentsCount > 0) {
    note = ` (Note: ${summary.invalidComponentsCount} invalid component(s) excluded from totals).`;
  }

  return {
    isQuestion: true,
    hasData: true,
    message: `Your current overall attendance is ${summary.formattedGrandPercentage} (${summary.grandTotalAttended} attended out of ${summary.grandTotalConducted} conducted across ${summary.validSubjects} subjects).${note}`,
  };
}

/**
 * Handles hypothetical projections such as:
 * - "I have attended 40 out of 50 classes. There are 8 more classes, and I'll attend all of them. What will my attendance be?"
 * - "I have 32 out of 40 classes. How many consecutive classes must I attend to reach 85%?"
 * - "What happens if I skip the next 2 lectures?"
 */
export function handleAttendanceProjection(
  text: string,
  existingSubjects: SubjectRecord[],
  settings: CalculationSettings
): ProjectionResult {
  let baselineAttended: number | undefined;
  let baselineConducted: number | undefined;
  let baselineQualification: string | undefined;

  // 1. Look for baseline in text: e.g. "I have attended 40 out of 50 classes", "I have 32 out of 40 classes", "40/50" or labeled "conducted 32, absent 5, attended 29"
  const baselineMatch =
    text.match(/(?:I\s+(?:currently\s+)?have\s+(?:attended\s+)?|current(?:ly)?\s+(?:at\s+|attendance\s+is\s+|have\s+)?|have\s+)(\d+)\s*(?:classes|lectures)?\s*(?:out\s+of|\/)\s*(\d+)/i) ||
    text.match(/\b(\d+)\s+(?:attended\s+)?out\s+of\s+(\d+)\s+classes/i) ||
    text.match(/\b(\d+)\s*\/\s*(\d+)\b/);

  const attendedLabeled = text.match(/\b(?:attended|present)\s*[:=]?\s*(\d+)\b/i) || text.match(/\b(\d+)\s+(?:attended|present)\b/i);
  const conductedLabeled = text.match(/\b(?:conducted|held|taken|total)\s*[:=]?\s*(\d+)\b/i) || text.match(/\b(\d+)\s+(?:conducted|held|taken|total)\b/i);

  if (baselineMatch) {
    baselineAttended = parseInt(baselineMatch[1], 10);
    baselineConducted = parseInt(baselineMatch[2], 10);
  } else if (attendedLabeled && conductedLabeled) {
    baselineAttended = parseInt(attendedLabeled[1], 10);
    baselineConducted = parseInt(conductedLabeled[1], 10);
  }

  if (baselineAttended !== undefined && baselineConducted !== undefined) {

    // Validate extracted baseline: attended cannot exceed conducted
    if (baselineAttended > baselineConducted) {
      return {
        isProjection: false,
        baselineAttended,
        baselineConducted,
        explanation: `Cannot compute projection from invalid baseline data: attended classes (${baselineAttended}) cannot exceed conducted classes (${baselineConducted}).`,
      };
    }

    // Check if text mentions contradictory absent count
    const absentInText = text.match(/\b(?:absent|missed)\s*[:=]?\s*(\d+)\b/i);
    if (absentInText) {
      const absentCount = parseInt(absentInText[1], 10);
      if (baselineAttended + absentCount !== baselineConducted) {
        return {
          isProjection: false,
          baselineAttended,
          baselineConducted,
          explanation: `Cannot compute projection from contradictory baseline data: attended (${baselineAttended}) + absent (${absentCount}) = ${
            baselineAttended + absentCount
          }, which does not match conducted (${baselineConducted}).`,
        };
      }
    }
  } else if (existingSubjects.length > 0) {
    const summary = calculateOverallSummary(existingSubjects, settings, [], []);

    if (summary.validComponentsCount === 0 || summary.grandOverallPercentage === null) {
      return {
        isProjection: false,
        explanation: 'Cannot compute projection: no valid baseline attendance data recorded. Please correct invalid records first.',
      };
    }

    baselineAttended = summary.grandTotalAttended;
    baselineConducted = summary.grandTotalConducted;

    if (summary.invalidComponentsCount > 0) {
      baselineQualification = `(Note: ${summary.invalidComponentsCount} invalid component(s) were excluded from baseline calculation).`;
    }
  }

  const baselinePercentage =
    baselineAttended !== undefined && baselineConducted !== undefined && baselineConducted > 0
      ? (baselineAttended / baselineConducted) * 100
      : undefined;

  // Extract Subject Name if present: e.g. "For OS, I attnded 27/32 lec..."
  let subjectName: string | undefined;
  const subjectMatch = text.match(/\b(?:for|in)\s+([A-Za-z0-9\s-]+?)(?:,|\s+I\b|\s+my\b|\s+we\b|:)/i);
  if (subjectMatch) {
    subjectName = subjectMatch[1].trim();
  }

  // 2. Case A: Future classes simulation (e.g. attend 8 more, skip 2, will attend the next 4 lectuers)
  let futureAttendedDelta: number | undefined;
  let futureConductedDelta: number | undefined;

  const attendMoreMatch =
    text.match(/(?:there\s+are\s+)?(\d+)\s+more\s+classes,\s*(?:and\s*)?I(?:'ll|\s+will)\s+attend\s+(?:all\s+of\s+them|all|\1)/i) ||
    text.match(/if\s+I\s+attend\s+(\d+)\s+more\s+classes/i) ||
    text.match(/(?:and\s+)?will\s+attend\s+(?:the\s+next\s+)?(\d+)\s*(?:lectuers?|lectures?|classes?|lecs?|tuts?|pracs?)/i);

  const skipMatch =
    text.match(/(?:what\s+happens\s+if\s+I\s+|if\s+I\s+)(?:skip|miss|bunk)\s+(?:the\s+next\s+)?(\d+)\s*(?:classes?|lectures?|lectuers?)/i) ||
    text.match(/(?:and\s+)?will\s+(?:miss|skip|bunk)\s+(?:the\s+next\s+)?(\d+)\s*(?:classes?|lectures?|lectuers?)/i);

  if (attendMoreMatch) {
    const num = parseInt(attendMoreMatch[1], 10);
    futureAttendedDelta = num;
    futureConductedDelta = num;
  } else if (skipMatch) {
    const num = parseInt(skipMatch[1], 10);
    futureAttendedDelta = 0;
    futureConductedDelta = num;
  }

  if (
    baselineAttended !== undefined &&
    baselineConducted !== undefined &&
    baselineConducted > 0 &&
    futureConductedDelta !== undefined
  ) {
    const projectedAttended = baselineAttended + (futureAttendedDelta ?? 0);
    const projectedConducted = baselineConducted + futureConductedDelta;
    const projectedPercentage = (projectedAttended / projectedConducted) * 100;
    const delta = projectedPercentage - (baselinePercentage ?? 0);
    const qual = baselineQualification ? ` ${baselineQualification}` : '';

    return {
      isProjection: true,
      subjectName,
      baselineAttended,
      baselineConducted,
      baselinePercentage,
      futureAttendedDelta,
      futureConductedDelta,
      projectedAttended,
      projectedConducted,
      projectedPercentage,
      percentageDelta: delta,
      explanation: `Current baseline: ${baselineAttended}/${baselineConducted} (${baselinePercentage?.toFixed(2)}%). If you attend ${futureAttendedDelta ?? 0} out of ${futureConductedDelta} upcoming classes, your attendance will be ${projectedAttended}/${projectedConducted} (${projectedPercentage.toFixed(2)}%), ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%.${qual}`,
    };
  }

  // 3. Case B: Target percentage projection (e.g. 32/40 to 85%, or "how many classes must I attend")
  const targetMatch = text.match(/(?:reach|target|get\s+to|bring\s+it\s+to)\s+(\d+(?:\.\d+)?)\s*%/i);
  const isTargetQuestion = targetMatch !== null || /how\s+many\s+(?:more\s+)?(?:consecutive\s+)?classes/i.test(text);

  if (
    isTargetQuestion &&
    baselineAttended !== undefined &&
    baselineConducted !== undefined &&
    baselineConducted > 0
  ) {
    const targetPercentage = targetMatch
      ? parseFloat(targetMatch[1])
      : (settings.targetPercentage ?? 75);

    const targetFrac = targetPercentage / 100;
    const current = (baselineAttended / baselineConducted) * 100;
    const qual = baselineQualification ? ` ${baselineQualification}` : '';

    if (current >= targetPercentage) {
      const maxMiss = Math.floor((baselineAttended - targetFrac * baselineConducted) / targetFrac);
      return {
        isProjection: true,
        subjectName,
        baselineAttended,
        baselineConducted,
        baselinePercentage,
        targetPercentage,
        classesNeeded: 0,
        classesCanMiss: Math.max(0, maxMiss),
        explanation: `Your current attendance (${current.toFixed(2)}%) is already at or above the ${targetPercentage}% target. You can miss up to ${Math.max(0, maxMiss)} upcoming classes while staying at or above target.${qual}`,
      };
    } else {
      const needed = Math.ceil((targetFrac * baselineConducted - baselineAttended) / (1 - targetFrac));
      const projectedAttended = baselineAttended + needed;
      const projectedConducted = baselineConducted + needed;
      const projectedPercentage = (projectedAttended / projectedConducted) * 100;

      return {
        isProjection: true,
        subjectName,
        baselineAttended,
        baselineConducted,
        baselinePercentage,
        targetPercentage,
        classesNeeded: needed,
        classesCanMiss: 0,
        projectedAttended,
        projectedConducted,
        projectedPercentage,
        explanation: `You currently have ${baselineAttended} out of ${baselineConducted} classes (${baselinePercentage?.toFixed(2)}%). To reach ${targetPercentage.toFixed(2)}%, you must attend ${needed} consecutive classes without missing any (bringing your total to ${projectedAttended}/${projectedConducted} = ${projectedPercentage.toFixed(2)}%).${qual}`,
      };
    }
  }

  return {
    isProjection: false,
    baselineAttended,
    baselineConducted,
    baselinePercentage,
    explanation: 'Could not establish complete baseline or future class count for this projection.',
  };
}

import type {
  CalculationSettings,
  ComponentCalculation,
  ComponentRecord,
  OverallCalculationSummary,
  ParsingWarning,
  SubjectCalculation,
  SubjectRecord,
  ValidationStatus,
} from '../types/attendance.js';
import { validateComponent } from './validator.js';

/**
 * Calculates attendance metrics for a single component.
 * Validates the component counts using the shared validator.
 */
export function calculateComponent(
  comp: ComponentRecord,
  effectiveWeight: number,
  subjectContext?: { id?: string; name?: string }
): ComponentCalculation {
  const validation = validateComponent(comp, subjectContext);
  const attended = comp.attended;
  const conducted = comp.conducted;
  const absent = comp.absent ?? (conducted !== null && attended !== null && conducted >= attended ? conducted - attended : null);

  let percentage: number | null = null;
  let formattedPercentage = 'N/A';

  if (validation.status === 'valid') {
    if (attended !== null && conducted !== null && conducted > 0) {
      percentage = (attended / conducted) * 100;
      formattedPercentage = `${percentage.toFixed(2)}%`;
    } else if (comp.percentage !== null && comp.percentage !== undefined) {
      percentage = comp.percentage;
      formattedPercentage = `${percentage.toFixed(2)}%`;
    }
  } else {
    // For invalid/unverified components, keep raw percentage for display with qualification, or N/A
    if (attended !== null && conducted !== null && conducted > 0 && attended <= conducted) {
      percentage = (attended / conducted) * 100;
      formattedPercentage = `${percentage.toFixed(2)}% (Invalid)`;
    } else if (comp.percentage !== null && comp.percentage !== undefined) {
      percentage = comp.percentage;
      formattedPercentage = `${percentage.toFixed(2)}% (Unverified)`;
    } else {
      formattedPercentage = 'N/A';
    }
  }

  const weightedAttended = attended !== null ? attended * effectiveWeight : 0;
  const weightedConducted = conducted !== null ? conducted * effectiveWeight : 0;

  return {
    componentId: comp.id,
    name: comp.name,
    type: comp.type,
    attended,
    conducted,
    absent,
    weight: effectiveWeight,
    percentage,
    formattedPercentage,
    weightedAttended,
    weightedConducted,
    sourceSnippet: comp.sourceSnippet,
    validationStatus: validation.status,
    validationReason: validation.reason,
  };
}

/**
 * Calculates overall attendance for a single subject according to the chosen method.
 * Excludes invalid components from trusted totals.
 */
export function calculateSubject(
  subject: SubjectRecord,
  settings: CalculationSettings,
  subjectWarnings: ParsingWarning[] = []
): SubjectCalculation {
  const method = settings.method;
  const weights = settings.weights;

  const componentCalculations: ComponentCalculation[] = subject.components.map((comp) => {
    const weight = comp.weight !== undefined ? comp.weight : (weights[comp.type] ?? 1.0);
    return calculateComponent(comp, weight, { id: subject.id, name: subject.name });
  });

  const validComponents = componentCalculations.filter((c) => c.validationStatus === 'valid');
  const invalidComponents = componentCalculations.filter((c) => c.validationStatus === 'invalid');
  const unverifiedComponents = componentCalculations.filter((c) => c.validationStatus === 'unverified');

  const validComponentsCount = validComponents.length;
  const invalidComponentsCount = invalidComponents.length;
  const unverifiedComponentsCount = unverifiedComponents.length;

  let validationStatus: ValidationStatus = 'valid';
  let isPartiallyValid = false;
  let statusMessage: string | undefined;
  let validationReason: string | undefined;

  if (invalidComponentsCount > 0) {
    validationStatus = 'invalid';
    if (validComponentsCount > 0) {
      isPartiallyValid = true;
      statusMessage = 'Incomplete — invalid records excluded';
      validationReason = `${invalidComponentsCount} invalid component(s) excluded from calculation.`;
    } else {
      isPartiallyValid = false;
      statusMessage = 'All components invalid — excluded from calculation';
      validationReason = 'All components contain errors and were excluded from calculation.';
    }
  } else if (unverifiedComponentsCount > 0) {
    validationStatus = 'unverified';
    if (validComponentsCount > 0) {
      isPartiallyValid = true;
      statusMessage = 'Partially unverified';
      validationReason = `${unverifiedComponentsCount} unverified component(s).`;
    } else {
      isPartiallyValid = false;
      statusMessage = 'Unverified records';
      validationReason = 'Missing raw counts; percentages cannot be independently verified.';
    }
  } else if (componentCalculations.length === 0) {
    validationStatus = 'invalid';
    isPartiallyValid = false;
    statusMessage = 'No components recorded';
    validationReason = 'No attendance components detected for this subject.';
  }

  let totalAttended = 0;
  let totalConducted = 0;
  let totalAbsent = 0;
  let totalWeightedAttended = 0;
  let totalWeightedConducted = 0;

  let overallPercentage: number | null = null;
  let formulaExplanation = '';
  let isValid = validationStatus === 'valid';

  if (componentCalculations.length === 0) {
    isValid = false;
    formulaExplanation = 'No attendance components detected for this subject.';
  } else if (method === 'raw-count') {
    // CRITICAL: Only VALID components contribute to totalAttended, totalConducted, and overall percentage
    for (const compCalc of validComponents) {
      if (compCalc.attended !== null && compCalc.conducted !== null) {
        totalAttended += compCalc.attended;
        totalConducted += compCalc.conducted;
        if (compCalc.absent !== null) totalAbsent += compCalc.absent;
        totalWeightedAttended += compCalc.weightedAttended;
        totalWeightedConducted += compCalc.weightedConducted;
      }
    }

    if (validComponents.length > 0 && totalWeightedConducted > 0) {
      overallPercentage = (totalWeightedAttended / totalWeightedConducted) * 100;

      // Build explanation formula string from valid components
      const attendedParts = validComponents
        .filter((c) => c.attended !== null)
        .map((c) => (c.weight === 1.0 ? `${c.attended}` : `(${c.attended} × ${c.weight})`))
        .join(' + ');

      const conductedParts = validComponents
        .filter((c) => c.conducted !== null)
        .map((c) => (c.weight === 1.0 ? `${c.conducted}` : `(${c.conducted} × ${c.weight})`))
        .join(' + ');

      formulaExplanation = `Weighted Attended (${attendedParts} = ${totalWeightedAttended}) ÷ Weighted Conducted (${conductedParts} = ${totalWeightedConducted}) × 100 = ${overallPercentage.toFixed(2)}%`;

      if (invalidComponentsCount > 0) {
        formulaExplanation += ` [Incomplete: ${invalidComponentsCount} invalid component(s) excluded: ${invalidComponents.map((c) => `${c.name} (${c.validationReason})`).join(', ')}]`;
      }
    } else if (totalWeightedConducted === 0 && validComponents.length > 0) {
      isValid = false;
      formulaExplanation = 'Total conducted classes is 0; attendance percentage is undefined.';
    } else {
      // Check if percentages exist in unverified components
      const unverifiedWithPct = unverifiedComponents.filter((c) => c.percentage !== null);
      if (unverifiedWithPct.length > 0 && invalidComponentsCount === 0) {
        let sumPctWeight = 0;
        let sumWeight = 0;
        for (const c of unverifiedWithPct) {
          sumPctWeight += (c.percentage as number) * c.weight;
          sumWeight += c.weight;
        }
        if (sumWeight > 0) {
          overallPercentage = sumPctWeight / sumWeight;
          formulaExplanation = `Calculated using unverified component percentages: Σ(% × weight) / Σ(weight) = ${overallPercentage.toFixed(2)}%`;
        }
      } else {
        isValid = false;
        overallPercentage = null;
        if (invalidComponentsCount > 0) {
          formulaExplanation = `No valid components to calculate attendance. (${invalidComponents.map((c) => `${c.name}: ${c.validationReason}`).join('; ')})`;
        } else {
          formulaExplanation = 'Incomplete attendance numbers. Please provide counts.';
        }
      }
    }
  } else {
    // ERP-percentage weighted method: sum(percentage * weight) / sum(weight) from valid components
    let sumWeightedPct = 0;
    let sumWeight = 0;
    let hasPct = false;

    for (const compCalc of validComponents) {
      if (compCalc.percentage !== null) {
        sumWeightedPct += compCalc.percentage * compCalc.weight;
        sumWeight += compCalc.weight;
        hasPct = true;
      }
    }

    if (hasPct && sumWeight > 0) {
      overallPercentage = sumWeightedPct / sumWeight;
      const parts = validComponents
        .filter((c) => c.percentage !== null)
        .map((c) => `(${c.percentage?.toFixed(2)}% × ${c.weight})`)
        .join(' + ');
      formulaExplanation = `Σ(Percentage × Weight) [${parts}] ÷ Total Weight (${sumWeight}) = ${overallPercentage.toFixed(2)}%`;

      if (invalidComponentsCount > 0) {
        formulaExplanation += ` [Incomplete: ${invalidComponentsCount} invalid component(s) excluded: ${invalidComponents.map((c) => `${c.name} (${c.validationReason})`).join(', ')}]`;
      }
    } else {
      isValid = false;
      overallPercentage = null;
      formulaExplanation =
        invalidComponentsCount > 0
          ? `No valid components to calculate attendance. (${invalidComponents.map((c) => `${c.name}: ${c.validationReason}`).join('; ')})`
          : 'Missing percentage data to compute ERP-percentage weighted result.';
    }
  }

  // Target attendance analysis (e.g., target 75% or 85%)
  // Ensure target calculations use valid baseline data only!
  let targetAnalysis: SubjectCalculation['targetAnalysis'] | undefined;
  if (
    settings.targetPercentage !== undefined &&
    overallPercentage !== null &&
    totalConducted > 0 &&
    (isValid || isPartiallyValid)
  ) {
    const target = settings.targetPercentage;
    const targetFrac = target / 100;
    const current = overallPercentage;

    if (current >= target) {
      const maxMiss = Math.floor((totalAttended - targetFrac * totalConducted) / targetFrac);
      targetAnalysis = {
        target,
        current,
        status: current === target ? 'on_track' : 'above',
        classesNeeded: 0,
        classesCanMiss: Math.max(0, maxMiss),
      };
    } else {
      const needed = Math.ceil((targetFrac * totalConducted - totalAttended) / (1 - targetFrac));
      targetAnalysis = {
        target,
        current,
        status: 'below',
        classesNeeded: Math.max(0, needed),
        classesCanMiss: 0,
      };
    }
  }

  const warnings = subjectWarnings.filter((w) => w.subjectId === subject.id || w.subjectName === subject.name);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    subjectCode: subject.code,
    method,
    components: componentCalculations,
    totalAttended,
    totalConducted,
    totalAbsent,
    totalWeightedAttended,
    totalWeightedConducted,
    overallPercentage,
    formattedPercentage: overallPercentage !== null ? `${overallPercentage.toFixed(2)}%` : 'N/A',
    isValid,
    hasWarnings: warnings.length > 0 || invalidComponentsCount > 0,
    formulaExplanation,
    targetAnalysis,
    warnings,
    validationStatus,
    validationReason,
    isPartiallyValid,
    validComponentsCount,
    invalidComponentsCount,
    unverifiedComponentsCount,
    statusMessage,
  };
}

/**
 * Calculates complete summary across all subjects.
 * Validates that grand totals and summary cards only incorporate verified, valid components.
 */
export function calculateOverallSummary(
  subjects: SubjectRecord[],
  settings: CalculationSettings,
  warnings: ParsingWarning[],
  mergeSuggestions: OverallCalculationSummary['mergeSuggestions']
): OverallCalculationSummary {
  const subjectCalculations: SubjectCalculation[] = [];
  let grandTotalAttended = 0;
  let grandTotalConducted = 0;
  let grandTotalWeightedAttended = 0;
  let grandTotalWeightedConducted = 0;
  let totalComponents = 0;
  let validComponentsCount = 0;
  let invalidComponentsCount = 0;
  let unverifiedComponentsCount = 0;
  let validSubjects = 0;
  let incompleteSubjects = 0;
  let warningSubjects = 0;

  for (const subject of subjects) {
    const calc = calculateSubject(subject, settings, warnings);
    subjectCalculations.push(calc);

    totalComponents += subject.components.length;
    validComponentsCount += calc.validComponentsCount;
    invalidComponentsCount += calc.invalidComponentsCount;
    unverifiedComponentsCount += calc.unverifiedComponentsCount;

    if (calc.isValid && !calc.isPartiallyValid && calc.overallPercentage !== null) {
      validSubjects++;
    } else {
      incompleteSubjects++;
    }

    if (calc.hasWarnings || calc.validationStatus === 'invalid') {
      warningSubjects++;
    }

    // Accumulate trusted totals (calc totals only sum valid components)
    grandTotalAttended += calc.totalAttended;
    grandTotalConducted += calc.totalConducted;
    grandTotalWeightedAttended += calc.totalWeightedAttended;
    grandTotalWeightedConducted += calc.totalWeightedConducted;
  }

  subjectCalculations.sort((a, b) => {
    const keyA = (a.subjectCode || a.subjectName).toLowerCase();
    const keyB = (b.subjectCode || b.subjectName).toLowerCase();
    return keyA.localeCompare(keyB);
  });

  let grandOverallPercentage: number | null = null;
  if (grandTotalWeightedConducted > 0 && validComponentsCount > 0) {
    grandOverallPercentage = (grandTotalWeightedAttended / grandTotalWeightedConducted) * 100;
  }

  let validationStatus: ValidationStatus = 'valid';
  let statusMessage: string | undefined;

  if (invalidComponentsCount > 0) {
    validationStatus = 'invalid';
    if (validComponentsCount > 0) {
      statusMessage = 'Incomplete — invalid records excluded';
    } else {
      statusMessage = 'All records invalid — excluded from calculation';
    }
  } else if (unverifiedComponentsCount > 0) {
    validationStatus = 'unverified';
    statusMessage = validComponentsCount > 0 ? 'Partially unverified' : 'Unverified records';
  }

  return {
    totalSubjects: subjects.length,
    validSubjects,
    incompleteSubjects,
    warningSubjects,
    totalComponents,
    validComponentsCount,
    invalidComponentsCount,
    unverifiedComponentsCount,
    validationStatus,
    statusMessage,
    grandTotalAttended,
    grandTotalConducted,
    grandTotalWeightedAttended,
    grandTotalWeightedConducted,
    grandOverallPercentage,
    formattedGrandPercentage:
      grandOverallPercentage !== null ? `${grandOverallPercentage.toFixed(2)}%` : 'N/A',
    subjectCalculations,
    warnings,
    mergeSuggestions,
  };
}

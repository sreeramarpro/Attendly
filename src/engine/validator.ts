import type {
  ComponentRecord,
  ParsingWarning,
  SubjectRecord,
  ValidationStatus,
} from '../types/attendance.js';

export interface ComponentValidationResult {
  status: ValidationStatus;
  reason?: string;
  warning?: ParsingWarning;
}

export interface SubjectValidationResult {
  status: ValidationStatus;
  isPartiallyValid: boolean;
  validCount: number;
  invalidCount: number;
  unverifiedCount: number;
  statusMessage?: string;
  reason?: string;
  warnings: ParsingWarning[];
}

/**
 * Single shared source-of-truth validation function for a single attendance component.
 * Validates counts for contradictions, impossibility, zero conducted, or missing data.
 */
export function validateComponent(
  comp: ComponentRecord,
  subjectContext?: { id?: string; name?: string }
): ComponentValidationResult {
  const subName = subjectContext?.name || 'Subject';
  const subId = subjectContext?.id;

  // 1. Negative counts check
  if (
    (comp.attended !== null && comp.attended < 0) ||
    (comp.conducted !== null && comp.conducted < 0) ||
    (comp.absent !== null && comp.absent < 0)
  ) {
    const reason = 'Attendance counts cannot be negative.';
    const warning: ParsingWarning = {
      id: `warn-neg-${comp.id}`,
      subjectId: subId,
      subjectName: subName,
      componentId: comp.id,
      type: 'contradicting_records',
      message: `Negative attendance counts detected for "${subName}" (${comp.name}). Counts must be non-negative.`,
      snippet: comp.sourceSnippet,
      suggestedAction: 'Update counts to be non-negative.',
      resolvable: true,
    };
    comp.validationStatus = 'invalid';
    comp.validationReason = reason;
    return { status: 'invalid', reason, warning };
  }

  // 2. Missing counts check
  if (comp.attended === null || comp.conducted === null) {
    if (comp.percentage !== null && comp.percentage !== undefined) {
      const reason = 'Only percentage was provided; raw counts are missing and unverified.';
      comp.validationStatus = 'unverified';
      comp.validationReason = reason;
      return { status: 'unverified', reason };
    } else {
      const reason = 'Missing attended or conducted class counts.';
      const warning: ParsingWarning = {
        id: `warn-missing-${comp.id}`,
        subjectId: subId,
        subjectName: subName,
        componentId: comp.id,
        type: 'missing_counts',
        message: `Component "${comp.name}" in "${subName}" is missing attended or total counts.`,
        snippet: comp.sourceSnippet,
        suggestedAction: 'Fill in the numbers in the review table.',
        resolvable: true,
      };
      comp.validationStatus = 'invalid';
      comp.validationReason = reason;
      return { status: 'invalid', reason, warning };
    }
  }

  // 3. Zero conducted classes
  if (comp.conducted === 0) {
    const reason = 'Total conducted classes is 0; attendance percentage cannot be computed.';
    const warning: ParsingWarning = {
      id: `warn-zero-${comp.id}`,
      subjectId: subId,
      subjectName: subName,
      componentId: comp.id,
      type: 'zero_conducted',
      message: `Total conducted classes is 0 for "${subName}" (${comp.name}). Attendance percentage cannot be computed.`,
      snippet: comp.sourceSnippet,
      suggestedAction: 'Update conducted classes if classes have been held.',
      resolvable: true,
    };
    comp.validationStatus = 'invalid';
    comp.validationReason = reason;
    return { status: 'invalid', reason, warning };
  }

  // 4. Attended classes exceed conducted classes
  if (comp.attended > comp.conducted) {
    const reason = `Attended classes (${comp.attended}) exceed conducted classes (${comp.conducted}).`;
    const warning: ParsingWarning = {
      id: `warn-exceed-${comp.id}`,
      subjectId: subId,
      subjectName: subName,
      componentId: comp.id,
      type: 'attended_exceeds_conducted',
      message: `Attended classes (${comp.attended}) exceed conducted classes (${comp.conducted}) for "${subName}" (${comp.name}).`,
      snippet: comp.sourceSnippet,
      suggestedAction: 'Swap or correct the attended and conducted counts.',
      resolvable: true,
    };
    comp.validationStatus = 'invalid';
    comp.validationReason = reason;
    return { status: 'invalid', reason, warning };
  }

  // 5. Contradicting counts: attended + absent !== conducted
  if (
    comp.absent !== null &&
    !comp.isAbsentDerived &&
    comp.attended + comp.absent !== comp.conducted
  ) {
    const reason = `Contradicting numbers: attended (${comp.attended}) + absent (${comp.absent}) = ${
      comp.attended + comp.absent
    }, which does not match total conducted (${comp.conducted}).`;
    const warning: ParsingWarning = {
      id: `warn-contradict-${comp.id}`,
      subjectId: subId,
      subjectName: subName,
      componentId: comp.id,
      type: 'contradicting_records',
      message: `Contradicting numbers for "${subName}" (${comp.name}): attended (${comp.attended}) + absent (${
        comp.absent
      }) = ${comp.attended + comp.absent}, which does not match total conducted (${comp.conducted}).`,
      snippet: comp.sourceSnippet,
      suggestedAction: 'Check which count is correct and adjust in the review panel.',
      resolvable: true,
    };
    comp.validationStatus = 'invalid';
    comp.validationReason = reason;
    return { status: 'invalid', reason, warning };
  }

  // 6. Valid component
  comp.validationStatus = 'valid';
  comp.validationReason = undefined;
  return { status: 'valid' };
}

/**
 * Validates a full subject record and its components using the single shared validation rules.
 */
export function validateSubject(subject: SubjectRecord): SubjectValidationResult {
  const warnings: ParsingWarning[] = [];

  if (subject.components.length === 0) {
    const reason = `Subject "${subject.name}" has no attendance components recorded.`;
    const warning: ParsingWarning = {
      id: `warn-empty-${subject.id}`,
      subjectId: subject.id,
      subjectName: subject.name,
      type: 'missing_counts',
      message: reason,
      suggestedAction: 'Add a component and counts using the edit button.',
      resolvable: true,
    };
    warnings.push(warning);
    subject.validationStatus = 'invalid';
    subject.validationReason = reason;

    return {
      status: 'invalid',
      isPartiallyValid: false,
      validCount: 0,
      invalidCount: 0,
      unverifiedCount: 0,
      statusMessage: 'No components recorded',
      reason,
      warnings,
    };
  }

  let validCount = 0;
  let invalidCount = 0;
  let unverifiedCount = 0;

  for (const comp of subject.components) {
    const res = validateComponent(comp, { id: subject.id, name: subject.name });
    if (res.warning) {
      warnings.push(res.warning);
    }
    if (res.status === 'valid') validCount++;
    else if (res.status === 'invalid') invalidCount++;
    else if (res.status === 'unverified') unverifiedCount++;
  }

  let status: ValidationStatus = 'valid';
  let isPartiallyValid = false;
  let statusMessage: string | undefined;
  let reason: string | undefined;

  if (invalidCount > 0) {
    status = 'invalid';
    if (validCount > 0) {
      isPartiallyValid = true;
      statusMessage = 'Incomplete — invalid records excluded';
      reason = `${invalidCount} invalid component(s) excluded from calculation.`;
    } else {
      isPartiallyValid = false;
      statusMessage = 'All components invalid — excluded from calculation';
      reason = 'All components contain errors and were excluded from calculation.';
    }
  } else if (unverifiedCount > 0) {
    status = 'unverified';
    if (validCount > 0) {
      isPartiallyValid = true;
      statusMessage = 'Partially unverified';
      reason = `${unverifiedCount} unverified component(s).`;
    } else {
      isPartiallyValid = false;
      statusMessage = 'Unverified records';
      reason = 'Missing raw counts; percentages cannot be independently verified.';
    }
  } else {
    status = 'valid';
    isPartiallyValid = false;
  }

  subject.validationStatus = status;
  subject.validationReason = reason;

  return {
    status,
    isPartiallyValid,
    validCount,
    invalidCount,
    unverifiedCount,
    statusMessage,
    reason,
    warnings,
  };
}

/**
 * Validates extracted subjects and components, producing warnings for any issues found.
 * Deduplicates warnings across all subjects and components.
 */
export function validateSubjectRecords(subjects: SubjectRecord[]): ParsingWarning[] {
  const allWarnings: ParsingWarning[] = [];

  for (const subject of subjects) {
    const result = validateSubject(subject);
    allWarnings.push(...result.warnings);
  }

  // Deduplicate warnings by key: type + subject + component + message
  const seen = new Set<string>();
  const uniqueWarnings: ParsingWarning[] = [];
  for (const w of allWarnings) {
    const key = `${w.type}::${w.subjectId ?? w.subjectName ?? ''}::${w.componentId ?? ''}::${w.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueWarnings.push(w);
    }
  }

  return uniqueWarnings;
}

/**
 * Quick helper to check if a component is valid according to shared rules.
 */
export function isComponentValid(comp: ComponentRecord): boolean {
  return validateComponent(comp).status === 'valid';
}

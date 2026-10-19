import { describe, expect, it } from 'vitest';
import { calculateOverallSummary, calculateSubject } from '../engine/calculator.js';
import { exportToCSV, exportToTSV, formatAllSubjectsText, formatSingleSubjectText } from '../engine/exporter.js';
import { parseAndCalculate, processAttendanceInput } from '../engine/pipeline.js';
import { handleAttendanceProjection } from '../engine/projectionEngine.js';
import { isComponentValid, validateComponent } from '../engine/validator.js';
import {
  DEFAULT_WEIGHTS,
  type CalculationSettings,
  type SubjectRecord,
} from '../types/attendance.js';

const defaultSettings: CalculationSettings = {
  weights: DEFAULT_WEIGHTS,
  method: 'raw-count',
  targetPercentage: 75,
};

describe('Adversarial Attendance Validation & Robustness Test Suite', () => {
  // Test 1: Contradictory counts are excluded from trusted totals
  it('1. Contradictory counts are excluded from trusted totals and grand percentage', () => {
    // 29 attended + 5 absent = 34, not 32.
    const input = 'Physics: conducted 32, absent 5, attended 29';
    const { summary, parseResult } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];

    // Raw entered values are retained on the component for user inspection & correction
    expect(sub.components.length).toBe(1);
    const comp = sub.components[0];
    expect(comp.attended).toBe(29);
    expect(comp.conducted).toBe(32);
    expect(comp.absent).toBe(5);
    expect(comp.validationStatus).toBe('invalid');
    expect(comp.validationReason).toContain('Contradicting numbers');
    expect(comp.validationReason).toContain('34');
    expect(comp.validationReason).toContain('32');

    // Trusted totals strictly exclude contradictory data
    expect(sub.totalAttended).toBe(0);
    expect(sub.totalConducted).toBe(0);
    expect(sub.totalAbsent).toBe(0);
    expect(sub.totalWeightedAttended).toBe(0);
    expect(sub.totalWeightedConducted).toBe(0);
    expect(sub.overallPercentage).toBeNull();
    expect(sub.formattedPercentage).toBe('N/A');
    expect(sub.isValid).toBe(false);
    expect(sub.isPartiallyValid).toBe(false);
    expect(sub.validationStatus).toBe('invalid');
    expect(sub.statusMessage).toBe('All components invalid — excluded from calculation');

    // Grand totals are not contaminated
    expect(summary.grandTotalAttended).toBe(0);
    expect(summary.grandTotalConducted).toBe(0);
    expect(summary.grandTotalWeightedAttended).toBe(0);
    expect(summary.grandTotalWeightedConducted).toBe(0);
    expect(summary.grandOverallPercentage).toBeNull();
    expect(summary.formattedGrandPercentage).toBe('N/A');
    expect(summary.validationStatus).toBe('invalid');
    expect(summary.statusMessage).toBe('All records invalid — excluded from calculation');

    // Contradicting record warning is generated
    expect(parseResult.warnings.some((w) => w.type === 'contradicting_records')).toBe(true);
  });

  // Test 2: Correcting an invalid record makes it eligible for calculations
  it('2. Correcting an invalid record via review/edit makes it eligible for trusted calculations', () => {
    const input = 'Physics: conducted 32, absent 5, attended 29';
    const { parseResult } = parseAndCalculate(input, defaultSettings);
    const subject = parseResult.subjects[0];

    // Initial state is invalid
    expect(subject.components[0].validationStatus).toBe('invalid');

    // User corrects attended count to 27 (27 + 5 = 32)
    const correctedSubject: SubjectRecord = {
      ...subject,
      components: [
        {
          ...subject.components[0],
          attended: 27,
          conducted: 32,
          absent: 5,
        },
      ],
    };

    // Revalidation verifies the corrected record
    const compValidation = validateComponent(correctedSubject.components[0]);
    expect(compValidation.status).toBe('valid');
    expect(isComponentValid(correctedSubject.components[0])).toBe(true);

    // Recalculation now incorporates the corrected component
    const updatedCalc = calculateSubject(correctedSubject, defaultSettings);
    expect(updatedCalc.isValid).toBe(true);
    expect(updatedCalc.validationStatus).toBe('valid');
    expect(updatedCalc.totalAttended).toBe(27);
    expect(updatedCalc.totalConducted).toBe(32);
    expect(updatedCalc.totalAbsent).toBe(5);
    expect(updatedCalc.overallPercentage).toBeCloseTo(84.375, 3);
    expect(updatedCalc.formattedPercentage).toBe('84.38%');

    // Grand total recalculates correctly
    const summary = calculateOverallSummary([correctedSubject], defaultSettings, [], []);
    expect(summary.grandTotalAttended).toBe(27);
    expect(summary.grandTotalConducted).toBe(32);
    expect(summary.grandOverallPercentage).toBeCloseTo(84.375, 3);
    expect(summary.formattedGrandPercentage).toBe('84.38%');
    expect(summary.validationStatus).toBe('valid');
  });

  // Test 3: Subject with one valid and one invalid component reports its partial/incomplete status accurately
  it('3. A subject with one valid and one invalid component excludes the invalid one and reports partial status', () => {
    // Subject with 2 components: Lecture (valid: 20/20) and Lab (invalid: conducted 20, absent 10, attended 15 -> 15+10=25!=20)
    const subjectWithMixedComponents: SubjectRecord = {
      id: 'subj-mixed',
      name: 'Computer Networks',
      code: 'CS401',
      components: [
        {
          id: 'comp-lec',
          type: 'lecture',
          name: 'Lecture',
          attended: 20,
          conducted: 20,
          absent: 0,
          weight: 1.0,
          confidence: 'high',
          isAbsentDerived: false,
        },
        {
          id: 'comp-lab',
          type: 'practical',
          name: 'Practical',
          attended: 15,
          conducted: 20,
          absent: 10, // 15 + 10 = 25 != 20
          weight: 0.5,
          confidence: 'high',
          isAbsentDerived: false,
        },
      ],
    };

    const calc = calculateSubject(subjectWithMixedComponents, defaultSettings);

    // Practical is invalid; Lecture is valid
    expect(calc.validComponentsCount).toBe(1);
    expect(calc.invalidComponentsCount).toBe(1);
    expect(calc.isPartiallyValid).toBe(true);
    expect(calc.validationStatus).toBe('invalid');
    expect(calc.statusMessage).toBe('Incomplete — invalid records excluded');

    // Trusted totals ONLY count the valid Lecture component (20/20)
    // Lab (15/20) is EXCLUDED
    expect(calc.totalAttended).toBe(20);
    expect(calc.totalConducted).toBe(20);
    expect(calc.totalAbsent).toBe(0);
    expect(calc.totalWeightedAttended).toBe(20); // 20 * 1.0
    expect(calc.totalWeightedConducted).toBe(20); // 20 * 1.0
    expect(calc.overallPercentage).toBe(100.0);
    expect(calc.formattedPercentage).toBe('100.00%');
    expect(calc.formulaExplanation).toContain('Incomplete: 1 invalid component(s) excluded');

    // In overall summary, grand total reflects only the valid Lecture component
    const summary = calculateOverallSummary([subjectWithMixedComponents], defaultSettings, [], []);
    expect(summary.grandTotalAttended).toBe(20);
    expect(summary.grandTotalConducted).toBe(20);
    expect(summary.grandOverallPercentage).toBe(100.0);
    expect(summary.formattedGrandPercentage).toBe('100.00%');
    expect(summary.validComponentsCount).toBe(1);
    expect(summary.invalidComponentsCount).toBe(1);
    expect(summary.statusMessage).toBe('Incomplete — invalid records excluded');
  });

  // Test 4: Grand total with only invalid records displays N/A
  it('4. Grand total with only invalid records displays N/A (never 0%, NaN, or Infinity)', () => {
    const invalidSubjects: SubjectRecord[] = [
      {
        id: 'sub-1',
        name: 'Subject One',
        components: [
          {
            id: 'c1',
            type: 'lecture',
            name: 'Lecture',
            attended: 30,
            conducted: 30,
            absent: 10, // 30 + 10 = 40 != 30
            weight: 1.0,
            confidence: 'high',
            isAbsentDerived: false,
          },
        ],
      },
      {
        id: 'sub-2',
        name: 'Subject Two',
        components: [
          {
            id: 'c2',
            type: 'lecture',
            name: 'Lecture',
            attended: 28,
            conducted: 20, // attended > conducted
            absent: 0,
            weight: 1.0,
            confidence: 'high',
          },
        ],
      },
      {
        id: 'sub-3',
        name: 'Subject Three',
        components: [
          {
            id: 'c3',
            type: 'lecture',
            name: 'Lecture',
            attended: 0,
            conducted: 0, // zero conducted
            absent: 0,
            weight: 1.0,
            confidence: 'high',
          },
        ],
      },
    ];

    const summary = calculateOverallSummary(invalidSubjects, defaultSettings, [], []);

    expect(summary.validComponentsCount).toBe(0);
    expect(summary.invalidComponentsCount).toBe(3);
    expect(summary.validSubjects).toBe(0);
    expect(summary.incompleteSubjects).toBe(3);
    expect(summary.grandTotalAttended).toBe(0);
    expect(summary.grandTotalConducted).toBe(0);
    expect(summary.grandOverallPercentage).toBeNull();
    expect(summary.formattedGrandPercentage).toBe('N/A');
    expect(summary.formattedGrandPercentage).not.toBe('0%');
    expect(summary.formattedGrandPercentage).not.toBe('0.00%');
    expect(summary.formattedGrandPercentage).not.toBe('NaN%');
    expect(summary.formattedGrandPercentage).not.toBe('Infinity%');
  });

  // Test 5: Exported reports flag invalid records
  it('5. Exported reports (CSV, TSV, and text) preserve validation status and flag invalid records', () => {
    const mixedSubjects: SubjectRecord[] = [
      {
        id: 's1',
        name: 'Valid Subject',
        code: 'CS101',
        components: [
          {
            id: 'c1',
            type: 'lecture',
            name: 'Lecture',
            attended: 25,
            conducted: 30,
            absent: 5,
            weight: 1.0,
            confidence: 'high',
            isAbsentDerived: false,
          },
        ],
      },
      {
        id: 's2',
        name: 'Invalid Subject',
        code: 'CS102',
        components: [
          {
            id: 'c2',
            type: 'lecture',
            name: 'Lecture',
            attended: 29,
            conducted: 32,
            absent: 5, // 29 + 5 = 34 != 32
            weight: 1.0,
            confidence: 'high',
            isAbsentDerived: false,
          },
        ],
      },
    ];

    const calcs = mixedSubjects.map((s) => calculateSubject(s, defaultSettings));

    // CSV Export
    const csv = exportToCSV(calcs);
    expect(csv).toContain('Validation Status');
    expect(csv).toContain('Validation Reason');
    expect(csv).toContain('valid');
    expect(csv).toContain('invalid');
    expect(csv).toContain('Contradicting numbers');

    // TSV Export
    const tsv = exportToTSV(calcs);
    expect(tsv).toContain('Validation Status');
    expect(tsv).toContain('[INVALID]');

    // Human-readable summary
    const textReport = formatAllSubjectsText(calcs);
    expect(textReport).toContain('Validation Status: VALID');
    expect(textReport).toContain('Validation Status: INVALID');
    expect(textReport).toContain('[INVALID:');
    expect(textReport).toContain('Excluded from calculation');

    const singleText = formatSingleSubjectText(calcs[1]);
    expect(singleText).toContain('Validation Status: INVALID');
    expect(singleText).toContain('Status: All components invalid — excluded from calculation');
  });

  // Test 6: Target calculations and projections reject or clearly qualify invalid baseline data
  it('6. Target calculations and projections reject or qualify invalid baseline data', () => {
    // A. Projection with contradictory numbers in text
    const contradictoryProjection = handleAttendanceProjection(
      'I have conducted 32, absent 5, attended 29. How many more classes to reach 85%?',
      [],
      defaultSettings
    );
    expect(contradictoryProjection.isProjection).toBe(false);
    expect(contradictoryProjection.explanation).toContain('contradictory baseline data');

    // B. Projection with attended > conducted in text
    const impossibleProjection = handleAttendanceProjection(
      'I have attended 45 out of 40 classes. What will my attendance be?',
      [],
      defaultSettings
    );
    expect(impossibleProjection.isProjection).toBe(false);
    expect(impossibleProjection.explanation).toContain('attended classes (45) cannot exceed conducted classes (40)');

    // C. Projection from invalid existing subjects
    const invalidExisting: SubjectRecord[] = [
      {
        id: 'inv',
        name: 'Physics',
        components: [
          {
            id: 'c1',
            type: 'lecture',
            name: 'Lecture',
            attended: 29,
            conducted: 32,
            absent: 5,
            weight: 1.0,
            confidence: 'high',
            isAbsentDerived: false,
          },
        ],
      },
    ];
    const existingProjection = handleAttendanceProjection(
      'What happens if I skip the next 2 lectures?',
      invalidExisting,
      defaultSettings
    );
    expect(existingProjection.isProjection).toBe(false);
    expect(existingProjection.explanation).toContain('no valid baseline attendance data recorded');

    // D. Target analysis on a completely invalid subject is undefined
    const invalidSubjectCalc = calculateSubject(invalidExisting[0], defaultSettings);
    expect(invalidSubjectCalc.targetAnalysis).toBeUndefined();

    // E. Target analysis on a partially valid subject uses only valid component data
    const partiallyValidSubject: SubjectRecord = {
      id: 'part',
      name: 'Partial Subject',
      components: [
        {
          id: 'c-valid',
          type: 'lecture',
          name: 'Lecture',
          attended: 20,
          conducted: 40, // 50% attendance
          absent: 20,
          weight: 1.0,
          confidence: 'high',
          isAbsentDerived: false,
        },
        {
          id: 'c-inv',
          type: 'practical',
          name: 'Practical',
          attended: 50, // invalid (attended > conducted)
          conducted: 20,
          absent: 0,
          weight: 1.0,
          confidence: 'high',
        },
      ],
    };
    const partialCalc = calculateSubject(partiallyValidSubject, { ...defaultSettings, targetPercentage: 75 });
    expect(partialCalc.isPartiallyValid).toBe(true);
    expect(partialCalc.targetAnalysis).toBeDefined();
    // Current is 50%, target is 75%
    expect(partialCalc.targetAnalysis?.current).toBe(50.0);
    expect(partialCalc.targetAnalysis?.status).toBe('below');
    // To reach 75% from 20/40: (20 + x)/(40 + x) >= 0.75 -> 20 + x >= 30 + 0.75x -> 0.25x >= 10 -> x = 40 classes needed
    expect(partialCalc.targetAnalysis?.classesNeeded).toBe(40);
  });

  // Test 7: Existing valid attendance calculations remain unchanged
  it('7. Existing valid attendance calculations remain completely unchanged', () => {
    // A. 26/28 and 16/24 -> 85.00%
    const res1 = parseAndCalculate('ASE lecture 26/28 and practical 16/24', defaultSettings);
    expect(res1.summary.subjectCalculations[0].formattedPercentage).toBe('85.00%');
    expect(res1.summary.subjectCalculations[0].validationStatus).toBe('valid');

    // B. Mathematics lecture 25/30 -> 83.33%
    const res2 = parseAndCalculate('Mathematics lecture 25/30', defaultSettings);
    expect(res2.summary.subjectCalculations[0].formattedPercentage).toBe('83.33%');
    expect(res2.summary.subjectCalculations[0].validationStatus).toBe('valid');

    // C. PDC theory 18/20, lab 16/22 -> 83.87%
    const res3 = parseAndCalculate('PDC theory 18/20 and lab 16/22', defaultSettings);
    expect(res3.summary.subjectCalculations[0].formattedPercentage).toBe('83.87%');
    expect(res3.summary.subjectCalculations[0].validationStatus).toBe('valid');

    // D. Valid labeled counts: conducted 32, absent 5, attended 27 (27 + 5 = 32)
    const res4 = parseAndCalculate('Physics: conducted 32, absent 5, attended 27', defaultSettings);
    expect(res4.summary.subjectCalculations[0].formattedPercentage).toBe('84.38%');
    expect(res4.summary.subjectCalculations[0].validationStatus).toBe('valid');
  });

  // Test 8: Reprocessing the same input does not duplicate records or warnings
  it('8. Reprocessing the same input does not duplicate records or warnings', () => {
    const invalidInput = 'Physics: conducted 32, absent 5, attended 29';

    // First processing
    const run1 = processAttendanceInput(invalidInput, defaultSettings);
    expect(run1.subjects.length).toBe(1);
    expect(run1.warnings.length).toBe(1);

    // Second processing (e.g. user clicks calculate again)
    const run2 = processAttendanceInput(invalidInput, defaultSettings);
    expect(run2.subjects.length).toBe(1);
    expect(run2.warnings.length).toBe(1);
    expect(run2.warnings[0].type).toBe('contradicting_records');

    // Reprocessing with existing subjects array passed in
    const run3 = processAttendanceInput(invalidInput, defaultSettings, run1.subjects);
    expect(run3.subjects.length).toBe(1);
    expect(run3.warnings.length).toBe(1);
  });
});

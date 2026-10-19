import { describe, expect, it } from 'vitest';
import { parseAndCalculate, processAttendanceInput } from '../engine/pipeline.js';
import type { CalculationSettings } from '../types/attendance.js';
import { DEFAULT_WEIGHTS } from '../types/attendance.js';

const defaultSettings: CalculationSettings = {
  weights: DEFAULT_WEIGHTS,
  method: 'raw-count',
  targetPercentage: 75,
};

describe('Attendly — Parser Reliability Repair v2 (Tests A through L)', () => {
  // Test A: Raw-count weighted formula verification
  it('Test A (Raw-count weighted formula verification)', () => {
    const input = 'OS: 27/32 lec, 9/12 prac';
    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const os = summary.subjectCalculations[0];
    expect(os.subjectName).toBe('OS');
    expect(os.components.length).toBe(2);

    const lec = os.components.find((c) => c.type === 'lecture');
    const prac = os.components.find((c) => c.type === 'practical');
    expect(lec).toBeDefined();
    expect(prac).toBeDefined();

    expect(lec?.attended).toBe(27);
    expect(lec?.conducted).toBe(32);
    expect(lec?.weight).toBe(1.0);

    expect(prac?.attended).toBe(9);
    expect(prac?.conducted).toBe(12);
    expect(prac?.weight).toBe(0.5);

    // Weighted attended: 27*1 + 9*0.5 = 31.5
    // Weighted conducted: 32*1 + 12*0.5 = 38
    // Raw-count weighted percentage: 31.5 / 38 * 100 = 82.89%
    expect(os.totalWeightedAttended).toBe(31.5);
    expect(os.totalWeightedConducted).toBe(38);
    expect(os.formattedPercentage).toBe('82.89%');
    expect(summary.formattedGrandPercentage).toBe('82.89%');

    // Reject naive unweighted average: (27 + 9) / (32 + 12) = 36/44 = 81.82%
    expect(os.formattedPercentage).not.toBe('81.82%');

    // Reject component percentage average: (84.38% + 75.00%) / 2 = 79.69%
    expect(os.formattedPercentage).not.toBe('79.69%');
  });

  // Test B: Contradictory data exclusion
  it('Test B (Contradictory data exclusion)', () => {
    const input = 'Physics: conducted 32, absent 5, attended 29';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const sub = parseResult.subjects[0];
    const comp = sub.components[0];

    // 29 + 5 = 34 !== 32, must be invalid
    expect(comp.validationStatus).toBe('invalid');
    expect(parseResult.warnings.some((w) => w.type === 'contradicting_records')).toBe(true);

    // Invalid component must be excluded from calculations
    expect(summary.validComponentsCount).toBe(0);
    expect(summary.invalidComponentsCount).toBe(1);
    expect(summary.grandOverallPercentage).toBeNull();
    expect(summary.formattedGrandPercentage).toBe('N/A');

    const physCalc = summary.subjectCalculations[0];
    expect(physCalc.overallPercentage).toBeNull();
    expect(physCalc.formattedPercentage).toBe('N/A');
    expect(physCalc.isValid).toBe(false);
  });

  // Test C: Mixed valid and invalid components
  it('Test C (Mixed valid and invalid components)', () => {
    const input = 'Math: 25/30 lec, 10/8 prac';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const sub = parseResult.subjects[0];
    expect(sub.components.length).toBe(2);

    const lec = sub.components.find((c) => c.type === 'lecture');
    const prac = sub.components.find((c) => c.type === 'practical');
    expect(lec).toBeDefined();
    expect(prac).toBeDefined();

    // Lecture valid
    expect(lec?.validationStatus).toBe('valid');
    expect(lec?.attended).toBe(25);
    expect(lec?.conducted).toBe(30);

    // Practical invalid: attended (10) > conducted (8), NOT silently swapped to 8/10
    expect(prac?.attended).toBe(10);
    expect(prac?.conducted).toBe(8);
    expect(prac?.validationStatus).toBe('invalid');

    // Subject is partially valid
    const mathCalc = summary.subjectCalculations[0];
    expect(mathCalc.isPartiallyValid).toBe(true);
    expect(mathCalc.validComponentsCount).toBe(1);
    expect(mathCalc.invalidComponentsCount).toBe(1);

    // Calculation uses only valid lecture component: 25 / 30 = 83.33%
    expect(mathCalc.formattedPercentage).toBe('83.33%');
    expect(summary.formattedGrandPercentage).toBe('83.33%');
    expect(summary.statusMessage).toContain('Incomplete — invalid records excluded');
  });

  // Test D: Common student typos
  it('Test D (Common student typos)', () => {
    const input = 'OS: 27/32 lectuer, 9/12 practcal. DBMS: 20/24 tut, 15/18 skl.';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(2);

    const os = parseResult.subjects.find((s) => s.name.toUpperCase() === 'OS');
    const dbms = parseResult.subjects.find((s) => s.name.toUpperCase() === 'DBMS');
    expect(os).toBeDefined();
    expect(dbms).toBeDefined();

    const osLec = os?.components.find((c) => c.type === 'lecture');
    const osPrac = os?.components.find((c) => c.type === 'practical');
    expect(osLec?.attended).toBe(27);
    expect(osLec?.conducted).toBe(32);
    expect(osLec?.weight).toBe(1.0);
    expect(osPrac?.attended).toBe(9);
    expect(osPrac?.conducted).toBe(12);
    expect(osPrac?.weight).toBe(0.5);

    const dbmsTut = dbms?.components.find((c) => c.type === 'tutorial');
    const dbmsSkl = dbms?.components.find((c) => c.type === 'skill');
    expect(dbmsTut?.attended).toBe(20);
    expect(dbmsTut?.conducted).toBe(24);
    expect(dbmsTut?.weight).toBe(1.0);
    expect(dbmsSkl?.attended).toBe(15);
    expect(dbmsSkl?.conducted).toBe(18);
    expect(dbmsSkl?.weight).toBe(0.25);

    expect(summary.validComponentsCount).toBe(4);
    expect(summary.invalidComponentsCount).toBe(0);
  });

  // Test E: Unanchored absence expression
  it('Test E (Unanchored absence expression)', () => {
    const input = 'I missed 5 lec and 7 prac';
    const parseResult = processAttendanceInput(input, defaultSettings);

    expect(parseResult.intent).toBe('ambiguous');
    expect(parseResult.isAmbiguous).toBe(true);
    expect(parseResult.subjects.length).toBe(0);
    expect(parseResult.clarificationPrompt).toContain('Which subject do these absences belong to');
    expect(parseResult.clarificationPrompt).toContain('total conducted classes known');
  });

  // Test F: Projection isolation
  it('Test F (Projection isolation)', () => {
    const input = 'For OS, I attnded 27/32 lec and will attend the next 4 lectuers';
    const parseResult = processAttendanceInput(input, defaultSettings);

    expect(parseResult.intent).toBe('projection');
    expect(parseResult.projectionResult).toBeDefined();
    expect(parseResult.projectionResult?.isProjection).toBe(true);

    // Current attendance baseline
    expect(parseResult.projectionResult?.baselineAttended).toBe(27);
    expect(parseResult.projectionResult?.baselineConducted).toBe(32);
    expect(parseResult.projectionResult?.baselinePercentage?.toFixed(2)).toBe('84.38');

    // Projected future attendance
    expect(parseResult.projectionResult?.projectedAttended).toBe(31);
    expect(parseResult.projectionResult?.projectedConducted).toBe(36);
    expect(parseResult.projectionResult?.projectedPercentage?.toFixed(2)).toBe('86.11');

    // Underlying subjects are not mutated to 31/36
    expect(parseResult.subjects.length).toBe(0);
  });

  // Test G: Typo-tolerant subject matching and duplicate handling
  it('Test G (Typo-tolerant subject matching and duplicate handling)', () => {
    // 1 & 2: Physics vs Phyics, Data Science vs Data Scince
    const input1 = `Physics: 28/32
Phyics: 28/32
Data Science: 18/20 lec
Data Scince: 19/20 lec`;

    const result1 = processAttendanceInput(input1, defaultSettings);

    // Must NOT silently merge
    expect(result1.subjects.length).toBe(4);

    // Must flag as potential duplicates / suggested merge candidates
    const physicsMerge = result1.mergeSuggestions.find(
      (m) =>
        (m.subjectAName.includes('Phys') && m.subjectBName.includes('Phy')) ||
        (m.subjectAName.includes('Phy') && m.subjectBName.includes('Phys'))
    );
    expect(physicsMerge).toBeDefined();

    const dsMerge = result1.mergeSuggestions.find(
      (m) =>
        (m.subjectAName.includes('Data') && m.subjectBName.includes('Data'))
    );
    expect(dsMerge).toBeDefined();

    // 3: Duplicate component with differing counts
    const input2 = `OS: lec 27/32
OS: lecture 28/33`;

    const result2 = processAttendanceInput(input2, defaultSettings);
    expect(result2.subjects.length).toBe(1);
    const osDupWarn = result2.warnings.find((w) => w.type === 'potential_duplicate');
    expect(osDupWarn).toBeDefined();
    expect(osDupWarn?.message).toContain('replace the first or represent additional classes');
  });

  // Test H: ERP table column misalignment and no silent swap
  it('Test H (ERP table column misalignment and no silent swap)', () => {
    const input = `
1 24CS101 Intro to CS Lecture S1 2024 1 0 01-Jan-2024 8 12 0 0 150.00 Y
`;
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const sub = parseResult.subjects[0];
    expect(sub.components.length).toBe(1);

    const comp = sub.components[0];
    // Conducted was column 10 (8), Attended was column 11 (12)
    // Must NOT silently swap to conducted 12, attended 8
    expect(comp.conducted).toBe(8);
    expect(comp.attended).toBe(12);

    // Must flag attended_exceeds_conducted and mark invalid
    expect(comp.validationStatus).toBe('invalid');
    expect(parseResult.warnings.some((w) => w.type === 'attended_exceeds_conducted')).toBe(true);

    // Excluded from grand total
    expect(summary.validComponentsCount).toBe(0);
    expect(summary.invalidComponentsCount).toBe(1);
    expect(summary.grandOverallPercentage).toBeNull();
    expect(summary.formattedGrandPercentage).toBe('N/A');
  });

  // Test I: Natural language question with typo / trailing please
  it('Test I (Natural language question with typo / trailing please)', () => {
    const input = 'Calculate my attendance please';
    const parseResult = processAttendanceInput(input, defaultSettings);

    expect(parseResult.intent).toBe('question');
    expect(parseResult.questionResult?.isQuestion).toBe(true);
    expect(parseResult.subjects.length).toBe(0);
  });

  // Test J: Multi-component subject with all four types
  it('Test J (Multi-component subject with all four types)', () => {
    const input = 'AI: 18/20 lec, 9/10 tut, 8/12 prac, 16/20 skl';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const ai = parseResult.subjects[0];
    expect(ai.components.length).toBe(4);

    const lec = ai.components.find((c) => c.type === 'lecture');
    const tut = ai.components.find((c) => c.type === 'tutorial');
    const prac = ai.components.find((c) => c.type === 'practical');
    const skl = ai.components.find((c) => c.type === 'skill');

    expect(lec).toBeDefined();
    expect(tut).toBeDefined();
    expect(prac).toBeDefined();
    expect(skl).toBeDefined();

    expect(lec?.weight).toBe(1.0);
    expect(tut?.weight).toBe(1.0);
    expect(prac?.weight).toBe(0.5);
    expect(skl?.weight).toBe(0.25);

    // Weighted attended: 18*1 + 9*1 + 8*0.5 + 16*0.25 = 18 + 9 + 4 + 4 = 35
    // Weighted conducted: 20*1 + 10*1 + 12*0.5 + 20*0.25 = 20 + 10 + 6 + 5 = 41
    // Expected percentage: 35 / 41 * 100 = 85.3658...% -> 85.37%
    const aiCalc = summary.subjectCalculations[0];
    expect(aiCalc.totalWeightedAttended).toBe(35);
    expect(aiCalc.totalWeightedConducted).toBe(41);
    expect(aiCalc.formattedPercentage).toBe('85.37%');
    expect(summary.formattedGrandPercentage).toBe('85.37%');
  });

  // Test K: Bare numbers without relationships
  it('Test K (Bare numbers without relationships)', () => {
    const input = 'Networks: 20, 18, 2';
    const parseResult = processAttendanceInput(input, defaultSettings);

    expect(parseResult.intent).toBe('ambiguous');
    expect(parseResult.isAmbiguous).toBe(true);
    expect(parseResult.subjects.length).toBe(0);
    expect(parseResult.clarificationPrompt).toContain('What do the numbers');
    expect(parseResult.clarificationPrompt).toContain('Please specify which value is attended, conducted, and absent');
  });

  // Test L: Zero conducted classes
  it('Test L (Zero conducted classes)', () => {
    const input = 'Seminar: 0/0';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const sub = parseResult.subjects[0];
    const comp = sub.components[0];

    expect(comp.conducted).toBe(0);
    expect(comp.validationStatus).toBe('invalid');
    expect(parseResult.warnings.some((w) => w.type === 'zero_conducted')).toBe(true);

    expect(summary.validComponentsCount).toBe(0);
    expect(summary.invalidComponentsCount).toBe(1);
    expect(summary.grandOverallPercentage).toBeNull();
    expect(summary.formattedGrandPercentage).toBe('N/A');
  });
});

describe('Attendly — Post-Repair Audit Verification Suite (Phases 2 & 5)', () => {
  // Scenario A: Contradictory attendance end-to-end
  it('Scenario A.1: Physics: lecture 19/20, practical 12/8 excludes practical and computes 95.00%', () => {
    const input = 'Physics: lecture 19/20, practical 12/8';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const phys = summary.subjectCalculations[0];
    expect(phys.subjectName).toBe('Physics');
    expect(phys.components.length).toBe(2);

    const lec = phys.components.find((c) => c.type === 'lecture');
    const prac = phys.components.find((c) => c.type === 'practical');
    expect(lec?.validationStatus).toBe('valid');
    expect(prac?.validationStatus).toBe('invalid');
    expect(prac?.attended).toBe(12);
    expect(prac?.conducted).toBe(8);

    // Subject marked as partially valid
    expect(phys.isPartiallyValid).toBe(true);
    expect(phys.statusMessage).toContain('Incomplete — invalid records excluded');

    // Trusted totals only count lecture: 19/20 = 95.00%
    expect(phys.totalWeightedAttended).toBe(19);
    expect(phys.totalWeightedConducted).toBe(20);
    expect(phys.formattedPercentage).toBe('95.00%');
    expect(summary.formattedGrandPercentage).toBe('95.00%');

    // Grand summary indicates invalid records exist and are excluded
    expect(summary.invalidComponentsCount).toBe(1);
    expect(summary.validComponentsCount).toBe(1);
  });

  it('Scenario A.2: Physics: conducted 32, absent 5, attended 29 yields N/A grand total', () => {
    const input = 'Physics: conducted 32, absent 5, attended 29';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const phys = summary.subjectCalculations[0];
    expect(phys.isValid).toBe(false);
    expect(phys.validationStatus).toBe('invalid');
    expect(phys.overallPercentage).toBeNull();
    expect(phys.formattedPercentage).toBe('N/A');

    // Grand total is N/A (not 0%, not NaN)
    expect(summary.grandOverallPercentage).toBeNull();
    expect(summary.formattedGrandPercentage).toBe('N/A');
    expect(summary.invalidComponentsCount).toBe(1);
    expect(summary.validComponentsCount).toBe(0);
  });

  // Scenario B: Typo-tolerant component parsing end-to-end
  it('Scenario B: OS: 27/32 lectuer, 9/12 practcal calculates exactly 82.89%', () => {
    const input = 'OS: 27/32 lectuer, 9/12 practcal';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

    expect(parseResult.subjects.length).toBe(1);
    const os = summary.subjectCalculations[0];
    expect(os.components.length).toBe(2);

    const lec = os.components.find((c) => c.type === 'lecture');
    const prac = os.components.find((c) => c.type === 'practical');
    expect(lec).toBeDefined();
    expect(prac).toBeDefined();

    expect(lec?.attended).toBe(27);
    expect(lec?.conducted).toBe(32);
    expect(prac?.attended).toBe(9);
    expect(prac?.conducted).toBe(12);

    // Formula: (27 + 9*0.5) / (32 + 12*0.5) * 100 = 31.5 / 38 * 100 = 82.8947... -> 82.89%
    expect(os.totalWeightedAttended).toBe(31.5);
    expect(os.totalWeightedConducted).toBe(38);
    expect(os.formattedPercentage).toBe('82.89%');
    expect(summary.formattedGrandPercentage).toBe('82.89%');
  });

  // Scenario C: Ambiguous absence statement end-to-end
  it('Scenario C: I missed 5 lec n 7 prac creates no subjects and preserves existing state', () => {
    // 1. Process with no existing state
    const input = 'I missed 5 lec n 7 prac';
    const parseResult = processAttendanceInput(input, defaultSettings);

    expect(parseResult.intent).toBe('ambiguous');
    expect(parseResult.isAmbiguous).toBe(true);
    expect(parseResult.subjects.length).toBe(0);
    expect(parseResult.clarificationPrompt).toContain('Which subject do these absences belong to');
    expect(parseResult.clarificationPrompt).toContain('total conducted classes known');

    // 2. Process with existing subjects
    const existing = processAttendanceInput('OS: 27/32 lec', defaultSettings).subjects;
    expect(existing.length).toBe(1);

    const parseWithExisting = processAttendanceInput(input, defaultSettings, existing);
    expect(parseWithExisting.intent).toBe('ambiguous');
    // Does NOT mutate or delete existing subjects
    expect(parseWithExisting.subjects.length).toBe(1);
    expect(parseWithExisting.subjects[0].name).toBe('OS');
    expect(parseWithExisting.subjects[0].components[0].attended).toBe(27);
    expect(parseWithExisting.subjects[0].components[0].conducted).toBe(32);
  });

  // Phase 5 Requirement 6: Correcting an invalid component restores eligibility
  it('Requirement 6: Correcting an invalid component restores eligibility and recalculates totals', () => {
    const invalidInput = 'Physics: conducted 32, absent 5, attended 29';
    const run1 = processAttendanceInput(invalidInput, defaultSettings);
    expect(run1.subjects[0].components[0].validationStatus).toBe('invalid');

    // User corrects attended to 27 (so 27 + 5 = 32)
    const correctedSubject = {
      ...run1.subjects[0],
      components: [
        {
          ...run1.subjects[0].components[0],
          attended: 27,
          conducted: 32,
          absent: 5,
          isAbsentDerived: false,
        },
      ],
    };

    const { summary } = parseAndCalculate('', defaultSettings, [correctedSubject]);
    expect(summary.validComponentsCount).toBe(1);
    expect(summary.invalidComponentsCount).toBe(0);
    expect(summary.formattedGrandPercentage).toBe('84.38%');
    expect(summary.subjectCalculations[0].isValid).toBe(true);
  });

  // Phase 5 Requirement 7: UI summary and exports use identical eligible records
  it('Requirement 7: UI summary and export use identical eligible records and flag invalid data', async () => {
    const { exportToCSV, exportToTSV, formatSingleSubjectText } = await import('../engine/exporter.js');

    const input = 'Math: 25/30 lec, 10/8 prac';
    const { summary } = parseAndCalculate(input, defaultSettings);

    const csv = exportToCSV(summary.subjectCalculations);
    const tsv = exportToTSV(summary.subjectCalculations);
    const singleText = formatSingleSubjectText(summary.subjectCalculations[0]);

    // CSV asserts invalid practical is marked invalid and excluded
    expect(csv).toContain('25,30,5,1.00,83.33%');
    expect(csv).toContain('Practical,10,8,,0.50,N/A');
    expect(csv).toContain('invalid,Attended classes (10) exceed conducted classes (8).');

    // TSV asserts excluded status
    expect(tsv).toContain('Practical: 10/8 [INVALID]');
    expect(tsv).toContain('83.33%');

    // Text format states excluded from calculation
    expect(singleText).toContain('(Excluded from calculation)');
    expect(singleText).toContain('Overall Attendance: 83.33%');
  });

  // Phase 5 Requirement 8: Duplicate component cannot silently inflate totals
  it('Requirement 8: Duplicate component cannot silently inflate totals', () => {
    const input = `OS: lec 27/32
OS: lecture 28/33`;

    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const os = summary.subjectCalculations[0];
    // Only the first component is kept, not both!
    expect(os.components.length).toBe(1);
    expect(os.totalAttended).toBe(27);
    expect(os.totalConducted).toBe(32);
    // Conducted is NOT inflated to 32 + 33 = 65
    expect(os.totalConducted).not.toBe(65);
    expect(os.formattedPercentage).toBe('84.38%');
  });
});

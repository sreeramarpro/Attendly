import { describe, expect, it } from 'vitest';
import { calculateSubject } from '../engine/calculator.js';
import { exportToCSV, exportToTSV } from '../engine/exporter.js';
import { parseAndCalculate } from '../engine/pipeline.js';
import {
  DEFAULT_WEIGHTS,
  type CalculationSettings,
  type SubjectRecord,
} from '../types/attendance.js';

const defaultSettings: CalculationSettings = {
  weights: DEFAULT_WEIGHTS,
  method: 'raw-count',
};

describe('Attendly Engine Tests', () => {
  // Test 1: Lecture 26/28 and practical 16/24 produces 85.00%
  it('1. Lecture 26/28 and practical 16/24 produces 85.00%', () => {
    const input = 'ASE lecture 26/28 and practical 16/24';
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.overallPercentage).toBeCloseTo(85.0, 2);
    expect(sub.formattedPercentage).toBe('85.00%');
  });

  // Test 2: Lecture 18/20 and practical 16/22 produces 83.87%
  it('2. Lecture 18/20 and practical 16/22 produces 83.87%', () => {
    const input = 'PDC theory 18/20 and lab 16/22';
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.overallPercentage).toBeCloseTo(83.87, 2);
    expect(sub.formattedPercentage).toBe('83.87%');
  });

  // Test 3: A lecture-only subject calculates correctly
  it('3. A lecture-only subject calculates correctly', () => {
    const input = 'Mathematics lecture 25/30';
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.overallPercentage).toBeCloseTo((25 / 30) * 100, 2);
    expect(sub.formattedPercentage).toBe('83.33%');
  });

  // Test 4: Lecture and tutorial both use weight 1.0
  it('4. Lecture and tutorial both use weight 1.0', () => {
    const input = 'IAS theory 20/20 and tutorial 10/10';
    const { summary } = parseAndCalculate(input, defaultSettings);
    const sub = summary.subjectCalculations[0];
    // (20*1 + 10*1) / (20*1 + 10*1) = 30 / 30 = 100%
    expect(sub.totalWeightedAttended).toBe(30);
    expect(sub.totalWeightedConducted).toBe(30);
    expect(sub.overallPercentage).toBe(100.0);
  });

  // Test 5: Skill uses weight 0.25
  it('5. Skill uses weight 0.25', () => {
    const input = 'SOA theory 10/10 and skill 20/20';
    const { summary } = parseAndCalculate(input, defaultSettings);
    const sub = summary.subjectCalculations[0];
    // theory: 10 * 1 = 10. skill: 20 * 0.25 = 5. Total = 15 / 15 = 100%
    expect(sub.totalWeightedAttended).toBe(15);
    expect(sub.totalWeightedConducted).toBe(15);
  });

  // Test 6: Different column orders work when headings identify the values
  it('6. Different column orders work when headings identify the values', () => {
    const tableWithReversedCols = `
Course Name\tAttended\tConducted\tComponent\tCourse Code
Adaptive Software Engineering\t26\t28\tLecture\tCS301
Adaptive Software Engineering\t16\t24\tPractical\tCS301
`;
    const { summary } = parseAndCalculate(tableWithReversedCols, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.formattedPercentage).toBe('85.00%');
  });

  // Test 7: Equivalent information in a table and an English sentence produces the same result
  it('7. Equivalent information in a table and an English sentence produces the same result', () => {
    const tableInput = `
Subject\tType\tConducted\tAttended
PDC\tTheory\t20\t18
PDC\tLab\t22\t16
`;
    const sentenceInput = 'PDC theory 18/20, lab 16 attended from 22.';
    const resTable = parseAndCalculate(tableInput, defaultSettings);
    const resSentence = parseAndCalculate(sentenceInput, defaultSettings);

    expect(resTable.summary.subjectCalculations[0].formattedPercentage).toBe(
      resSentence.summary.subjectCalculations[0].formattedPercentage
    );
  });

  // Test 8: Multiple subjects in one paragraph are identified correctly
  it('8. Multiple subjects in one paragraph are identified correctly', () => {
    const paragraph =
      'ASE lecture 26 attended out of 28 and practical 16 out of 24. PDC theory 18/20, lab 16 attended from 22. Data science I went to 31 classes out of 36 lectures, practicals 16 out of 22.';
    const { summary } = parseAndCalculate(paragraph, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(3);
    const names = summary.subjectCalculations.map((s) => s.subjectName.toLowerCase());
    expect(names.some((n) => n.includes('ase'))).toBe(true);
    expect(names.some((n) => n.includes('pdc'))).toBe(true);
    expect(names.some((n) => n.includes('data science'))).toBe(true);
  });

  // Test 9: A long input containing at least ten subjects is handled correctly
  it('9. A long input containing at least ten subjects is handled correctly', () => {
    const tenSubjects = `
Sub1 theory 20/25
Sub2 theory 18/20
Sub3 theory 22/25
Sub4 theory 15/20
Sub5 theory 30/30
Sub6 theory 28/35
Sub7 theory 19/22
Sub8 theory 24/28
Sub9 theory 16/20
Sub10 theory 25/30
`;
    const { summary } = parseAndCalculate(tenSubjects, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(10);
    expect(summary.validSubjects).toBe(10);
  });

  // Test 10: Hundreds of records can be processed where practical
  it('10. Hundreds of records can be processed where practical', () => {
    const lines = ['Course Code\tCourse Name\tComponent\tConducted\tAttended'];
    for (let i = 1; i <= 200; i++) {
      lines.push(`CS${100 + i}\tCourse Number ${i}\tLecture\t30\t25`);
    }
    const start = performance.now();
    const { summary } = parseAndCalculate(lines.join('\n'), defaultSettings);
    const duration = performance.now() - start;

    expect(summary.subjectCalculations.length).toBe(200);
    expect(duration).toBeLessThan(1500); // Fast local processing
  });

  // Test 11: Blank lines and irrelevant headings do not affect calculations
  it('11. Blank lines and irrelevant headings do not affect calculations', () => {
    const messyInput = `
ACADEMIC YEAR 2024-2025 SEMESTER V
STUDENT ATTENDANCE REPORT
FACULTY: ENGINEERING & TECHNOLOGY

Course Code\tCourse Name\tSection\tCredits\tConducted\tAttended\tComponent
CS301\tSoftware Engineering\tSEC-A\t4\t28\t26\tLecture
CS301\tSoftware Engineering\tSEC-A\t2\t24\t16\tPractical

PRINTED ON 2024-11-20
`;
    const { summary } = parseAndCalculate(messyInput, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(1);
    expect(summary.subjectCalculations[0].formattedPercentage).toBe('85.00%');
  });

  // Test 12: Percentages are not mistaken for counts
  it('12. Percentages are not mistaken for counts', () => {
    const tableWithPct = `
Course Code\tCourse Name\tComponent\tConducted\tAttended\tPercentage
CS101\tOperating Systems\tLecture\t30\t27\t90.00%
`;
    const { summary } = parseAndCalculate(tableWithPct, defaultSettings);
    const sub = summary.subjectCalculations[0];
    expect(sub.totalConducted).toBe(30);
    expect(sub.totalAttended).toBe(27);
    expect(sub.formattedPercentage).toBe('90.00%');
  });

  // Test 13: Course codes and section numbers are not mistaken for attendance values
  it('13. Course codes and section numbers are not mistaken for attendance values', () => {
    const input = 'In CS301 section 4, I attended 26 out of 28 lectures.';
    const { summary } = parseAndCalculate(input, defaultSettings);
    const sub = summary.subjectCalculations[0];
    expect(sub.totalAttended).toBe(26);
    expect(sub.totalConducted).toBe(28);
  });

  // Test 14: Conducted and absent counts produce the correct attended count when clearly labeled
  it('14. Conducted and absent counts produce the correct attended count when clearly labeled', () => {
    const input = 'conducted 28, absent 2 in Computer Networks lecture';
    const { summary } = parseAndCalculate(input, defaultSettings);
    const sub = summary.subjectCalculations[0];
    expect(sub.totalConducted).toBe(28);
    expect(sub.totalAttended).toBe(26);
    expect(sub.totalAbsent).toBe(2);
  });

  // Test 15: Attended counts exceeding conducted counts trigger a warning
  it('15. Attended counts exceeding conducted counts trigger a warning', () => {
    const input = 'Databases lecture 28 attended out of 26';
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.warnings.some((w) => w.type === 'attended_exceeds_conducted')).toBe(true);
  });

  // Test 16: Zero conducted classes do not cause division-by-zero errors
  it('16. Zero conducted classes do not cause division-by-zero errors', () => {
    const input = 'Robotics lecture 0 attended out of 0';
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(1);
    expect(summary.subjectCalculations[0].formattedPercentage).toBe('N/A');
    expect(summary.warnings.some((w) => w.type === 'zero_conducted')).toBe(true);
  });

  // Test 17: Ambiguous values are flagged rather than guessed
  it('17. Ambiguous values are flagged rather than guessed', () => {
    const input = 'ASE 26 28';
    const { parseResult } = parseAndCalculate(input, defaultSettings);
    expect(parseResult.warnings.some((w) => w.type === 'ambiguous_values')).toBe(true);
  });

  // Test 18: Incomplete subjects do not block valid subjects
  it('18. Incomplete subjects do not block valid subjects', () => {
    const input = 'ASE lecture 26/28. I have Deep Learning, but I haven\'t entered attendance yet.';
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.validSubjects).toBe(1);
    expect(summary.incompleteSubjects).toBe(1);
    expect(summary.subjectCalculations[0].formattedPercentage).toBe('92.86%');
  });

  // Test 19: Repeated references to the same subject are merged only when appropriate
  it('19. Repeated references to the same subject are merged only when appropriate', () => {
    const input = `
CS301 Software Engineering lecture 26/28
CS301 Software Engineering practical 16/24
`;
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(1);
    expect(summary.subjectCalculations[0].components.length).toBe(2);
    expect(summary.subjectCalculations[0].formattedPercentage).toBe('85.00%');
  });

  // Test 20: Conflicting duplicate records are flagged
  it('20. Conflicting duplicate records are flagged', () => {
    const input = `
ASE lecture 26/28
ASE lecture 18/20
`;
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.warnings.some((w) => w.type === 'contradicting_records')).toBe(true);
  });

  // Test 21: ERP-percentage mode is distinct from raw-count weighted mode
  it('21. ERP-percentage mode is distinct from raw-count weighted mode', () => {
    // When lecture has 10/10 (100%, weight 1) and practical has 1/4 (25%, weight 0.5)
    // Raw-count weighted: (10 + 0.5) / (10 + 2) = 10.5 / 12 = 87.50%
    // ERP-percentage weighted: (100 * 1 + 25 * 0.5) / (1 + 0.5) = (100 + 12.5) / 1.5 = 75.00%
    const sub: SubjectRecord = {
      id: 'sub-test',
      name: 'Algorithm Analysis',
      components: [
        {
          id: 'c1',
          type: 'lecture',
          name: 'Lecture',
          attended: 10,
          conducted: 10,
          absent: 0,
          weight: 1.0,
          confidence: 'high',
        },
        {
          id: 'c2',
          type: 'practical',
          name: 'Practical',
          attended: 1,
          conducted: 4,
          absent: 3,
          weight: 0.5,
          confidence: 'high',
        },
      ],
    };

    const rawRes = calculateSubject(sub, { weights: DEFAULT_WEIGHTS, method: 'raw-count' });
    const erpRes = calculateSubject(sub, { weights: DEFAULT_WEIGHTS, method: 'erp-percentage' });

    expect(rawRes.formattedPercentage).toBe('87.50%');
    expect(erpRes.formattedPercentage).toBe('75.00%');
    expect(rawRes.formattedPercentage).not.toBe(erpRes.formattedPercentage);
  });

  // Test 22: Editing values updates calculations correctly
  it('22. Editing values updates calculations correctly', () => {
    const initialInput = 'ASE lecture 26/28 and practical 16/24';
    const { parseResult } = parseAndCalculate(initialInput, defaultSettings);
    const sub = parseResult.subjects[0];

    // User edits practical conducted count from 24 to 20
    const editedSubject: SubjectRecord = {
      ...sub,
      components: sub.components.map((c) =>
        c.type === 'practical' ? { ...c, conducted: 20 } : c
      ),
    };

    const updated = calculateSubject(editedSubject, defaultSettings);
    // (26 + 16*0.5) / (28 + 20*0.5) = 34 / 38 = 89.47%
    expect(updated.formattedPercentage).toBe('89.47%');
  });

  // Test 23: Exported data matches the displayed results
  it('23. Exported data matches the displayed results', () => {
    const input = 'ASE lecture 26/28 and practical 16/24';
    const { summary } = parseAndCalculate(input, defaultSettings);
    const csv = exportToCSV(summary.subjectCalculations);
    const tsv = exportToTSV(summary.subjectCalculations);

    expect(csv).toContain('85.00%');
    expect(csv).toContain('ASE');
    expect(tsv).toContain('85.00%');
    expect(tsv).toContain('ASE');
  });

  // Additional tests: Target attendance calculation
  it('calculates classes needed and bunkable classes correctly for 75% target', () => {
    const input = 'Operating Systems lecture 15/25'; // 60%
    const { summary } = parseAndCalculate(input, { ...defaultSettings, targetPercentage: 75 });
    const sub = summary.subjectCalculations[0];
    expect(sub.targetAnalysis).toBeDefined();
    expect(sub.targetAnalysis?.status).toBe('below');
    // To reach 75%: (15 + x) / (25 + x) >= 0.75 => 15 + x >= 18.75 + 0.75x => 0.25x >= 3.75 => x >= 15
    expect(sub.targetAnalysis?.classesNeeded).toBe(15);

    // Subject with 90% attendance: 27/30
    const highSubInput = 'Computer Networks lecture 27/30';
    const highRes = parseAndCalculate(highSubInput, { ...defaultSettings, targetPercentage: 75 });
    const highSub = highRes.summary.subjectCalculations[0];
    expect(highSub.targetAnalysis?.status).toBe('above');
    // Can miss: 27 / (30 + y) >= 0.75 => 27 >= 22.5 + 0.75y => 0.75y <= 4.5 => y <= 6
    expect(highSub.targetAnalysis?.classesCanMiss).toBe(6);
  });

  // Additional tests: Acronym merge suggestion
  it('suggests merge for acronyms with high confidence', () => {
    const input = `
ASE lecture 26/28
Adaptive Software Engineering practical 16/24
`;
    const { summary } = parseAndCalculate(input, defaultSettings);
    expect(summary.mergeSuggestions.length).toBeGreaterThan(0);
    expect(summary.mergeSuggestions[0].reason).toContain('abbreviation');
  });
});

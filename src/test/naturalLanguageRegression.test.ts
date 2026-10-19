import { describe, expect, it } from 'vitest';
import { parseAndCalculate, processAttendanceInput } from '../engine/pipeline.js';
import { DEFAULT_WEIGHTS, type CalculationSettings } from '../types/attendance.js';

const defaultSettings: CalculationSettings = {
  weights: DEFAULT_WEIGHTS,
  method: 'raw-count',
};

describe('Comprehensive Attendance Parser Regression Suite (Tests A through L & Tabular Tests)', () => {
  // Test A: Question without data
  it('A. Question without data: "Calculate my attendance"', () => {
    const input = 'Calculate my attendance';
    const { parseResult, summary } = parseAndCalculate(input, defaultSettings, []);

    expect(summary.subjectCalculations.length).toBe(0);
    expect(parseResult.subjects.length).toBe(0);
    expect(parseResult.intent).toBe('question');
    expect(parseResult.questionResult).toBeDefined();
    expect(parseResult.questionResult?.hasData).toBe(false);
    expect(parseResult.questionResult?.message).toContain('No attendance data recorded yet');
  });

  // Test B: Natural-language attendance
  it('B. Natural-language attendance: "Physics: conducted 32, absent 5, attended 27"', () => {
    const input = 'Physics: conducted 32, absent 5, attended 27';
    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.subjectName).toBe('Physics');
    expect(sub.totalConducted).toBe(32);
    expect(sub.totalAbsent).toBe(5);
    expect(sub.totalAttended).toBe(27);
    // 27 / 32 * 100 = 84.375%
    expect(sub.overallPercentage).toBeCloseTo(84.375, 3);
    expect(sub.formattedPercentage).toBe('84.38%');
  });

  // Test C: Multiple components
  it('C. Multiple components: "AI: L 18/20, T 9/10, P 8/12, S 16/20"', () => {
    const input = 'AI: L 18/20, T 9/10, P 8/12, S 16/20';
    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.subjectName).toBe('AI');
    expect(sub.components.length).toBe(4);

    const l = sub.components.find((c) => c.type === 'lecture');
    const t = sub.components.find((c) => c.type === 'tutorial');
    const p = sub.components.find((c) => c.type === 'practical');
    const s = sub.components.find((c) => c.type === 'skill');

    expect(l?.attended).toBe(18);
    expect(l?.conducted).toBe(20);
    expect(t?.attended).toBe(9);
    expect(t?.conducted).toBe(10);
    expect(p?.attended).toBe(8);
    expect(p?.conducted).toBe(12);
    expect(s?.attended).toBe(16);
    expect(s?.conducted).toBe(20);

    // Weighted attendance:
    // (18*1 + 9*1 + 8*0.5 + 16*0.25) / (20*1 + 10*1 + 12*0.5 + 20*0.25)
    // = (18 + 9 + 4 + 4) / (20 + 10 + 6 + 5) = 35 / 41 * 100 = 85.36585%
    expect(sub.totalWeightedAttended).toBe(35);
    expect(sub.totalWeightedConducted).toBe(41);
    expect(sub.overallPercentage).toBeCloseTo((35 / 41) * 100, 4);
    expect(sub.formattedPercentage).toBe('85.37%');
  });

  // Test D: Explicit component weights
  it('D. Explicit component weights: "Cloud Computing has L=30/32 and P=10/20. Lecture weight is 1 and practical weight is 0.5."', () => {
    const input =
      'Cloud Computing has L=30/32 and P=10/20. Lecture weight is 1 and practical weight is 0.5.';
    const { summary } = parseAndCalculate(input, defaultSettings);

    // Exactly 1 subject, weight instruction must not become a subject
    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.subjectName).toBe('Cloud Computing');
    expect(sub.components.length).toBe(2);

    // Weighted attendance: (30*1 + 10*0.5) / (32*1 + 20*0.5) = 35 / 42 * 100 = 83.3333%
    expect(sub.totalWeightedAttended).toBe(35);
    expect(sub.totalWeightedConducted).toBe(42);
    expect(sub.overallPercentage).toBeCloseTo((35 / 42) * 100, 3);
    expect(sub.formattedPercentage).toBe('83.33%');

    // Confirm no fake subjects were created
    const names = summary.subjectCalculations.map((s) => s.subjectName.toLowerCase());
    expect(names.some((n) => n.includes('weight'))).toBe(false);
  });

  // Test E: Future projection
  it('E. Future projection: "I have attended 40 out of 50 classes. There are 8 more classes, and I\'ll attend all of them."', () => {
    const input =
      "I have attended 40 out of 50 classes. There are 8 more classes, and I'll attend all of them.";
    const result = processAttendanceInput(input, defaultSettings);

    expect(result.intent).toBe('projection');
    // No saved records mutated
    expect(result.subjects.length).toBe(0);
    expect(result.projectionResult).toBeDefined();

    const proj = result.projectionResult!;
    expect(proj.baselineAttended).toBe(40);
    expect(proj.baselineConducted).toBe(50);
    expect(proj.projectedAttended).toBe(48);
    expect(proj.projectedConducted).toBe(58);
    // 48 / 58 * 100 = 82.75862%
    expect(proj.projectedPercentage).toBeCloseTo((48 / 58) * 100, 4);
  });

  // Test F: Zero denominator
  it('F. Zero denominator: conducted = 0, attended = 0 produces "N/A" and no division errors', () => {
    const input = 'Robotics: conducted 0, attended 0';
    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.totalConducted).toBe(0);
    expect(sub.totalAttended).toBe(0);
    expect(sub.formattedPercentage).toBe('N/A');
    expect(sub.overallPercentage).toBeNull();
    // Warning emitted
    expect(sub.warnings.some((w) => w.type === 'zero_conducted')).toBe(true);
  });

  // Test G: Inconsistent counts: contradictory counts excluded from totals and marked invalid
  it('G. Inconsistent counts: "Physics: conducted 32, absent 5, attended 29" triggers validation error', () => {
    const input = 'Physics: conducted 32, absent 5, attended 29';
    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];

    // Raw entered values are preserved on the component for review/edit
    expect(sub.components.length).toBe(1);
    const comp = sub.components[0];
    expect(comp.conducted).toBe(32);
    expect(comp.absent).toBe(5);
    expect(comp.attended).toBe(29);
    expect(comp.validationStatus).toBe('invalid');

    // Trusted totals exclude the contradictory component
    expect(sub.totalConducted).toBe(0);
    expect(sub.totalAttended).toBe(0);
    expect(sub.totalAbsent).toBe(0);
    expect(sub.overallPercentage).toBeNull();
    expect(sub.formattedPercentage).toBe('N/A');
    expect(sub.isValid).toBe(false);
    expect(sub.validationStatus).toBe('invalid');

    // Grand total is N/A
    expect(summary.grandOverallPercentage).toBeNull();
    expect(summary.formattedGrandPercentage).toBe('N/A');

    // 29 + 5 = 34 != 32, must flag contradicting_records warning
    const contradictionWarning = sub.warnings.find((w) => w.type === 'contradicting_records');
    expect(contradictionWarning).toBeDefined();
    expect(contradictionWarning?.message).toContain('Contradicting numbers');
    expect(contradictionWarning?.message).toContain('34');
    expect(contradictionWarning?.message).toContain('32');
  });

  // Test H: Multiple subjects
  it('H. Multiple subjects: "Maths 24/30, Physics 19/20, Chemistry 15/18" parses 3 subjects', () => {
    const input = 'Maths 24/30, Physics 19/20, Chemistry 15/18';
    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(3);

    const maths = summary.subjectCalculations.find((s) => s.subjectName.toLowerCase() === 'maths');
    const phys = summary.subjectCalculations.find((s) => s.subjectName.toLowerCase() === 'physics');
    const chem = summary.subjectCalculations.find((s) => s.subjectName.toLowerCase() === 'chemistry');

    expect(maths?.totalAttended).toBe(24);
    expect(maths?.totalConducted).toBe(30);
    expect(maths?.formattedPercentage).toBe('80.00%');

    expect(phys?.totalAttended).toBe(19);
    expect(phys?.totalConducted).toBe(20);
    expect(phys?.formattedPercentage).toBe('95.00%');

    expect(chem?.totalAttended).toBe(15);
    expect(chem?.totalConducted).toBe(18);
    expect(chem?.formattedPercentage).toBe('83.33%');
  });

  // Test I: Weighted attendance
  it('I. Weighted attendance: "Deep Learning: lectures 31/34 and practicals 12/24"', () => {
    const input = 'Deep Learning: lectures 31/34 and practicals 12/24';
    const { summary } = parseAndCalculate(input, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const sub = summary.subjectCalculations[0];
    expect(sub.subjectName).toBe('Deep Learning');
    expect(sub.components.length).toBe(2);

    // (31 + 12 * 0.5) / (34 + 24 * 0.5) * 100 = 37 / 46 * 100 = 80.43478%
    expect(sub.totalWeightedAttended).toBe(37);
    expect(sub.totalWeightedConducted).toBe(46);
    expect(sub.overallPercentage).toBeCloseTo((37 / 46) * 100, 4);
    expect(sub.formattedPercentage).toBe('80.43%');
  });

  // Test J: Target calculation
  it('J. Target calculation: "I currently have 32/40 classes. How many more classes must I attend to reach 85%?"', () => {
    const input =
      'I currently have 32/40 classes. How many more classes must I attend to reach 85%?';
    const result = processAttendanceInput(input, defaultSettings);

    expect(result.intent).toBe('projection');
    // No record mutation
    expect(result.subjects.length).toBe(0);
    expect(result.projectionResult).toBeDefined();

    const proj = result.projectionResult!;
    expect(proj.baselineAttended).toBe(32);
    expect(proj.baselineConducted).toBe(40);
    expect(proj.targetPercentage).toBe(85);
    // (32 + 14) / (40 + 14) = 46 / 54 = 85.185% >= 85%
    expect(proj.classesNeeded).toBe(14);
    expect(proj.explanation).toContain('14');
  });

  // Test K: Ambiguous numbers
  it('K. Ambiguous numbers: "Networks: the numbers are 20, 18 and 2." requests clarification and creates no record', () => {
    const input = 'Networks: the numbers are 20, 18 and 2.';
    const result = processAttendanceInput(input, defaultSettings);

    expect(result.intent).toBe('ambiguous');
    // Creates no record
    expect(result.subjects.length).toBe(0);
    expect(result.isAmbiguous).toBe(true);
    expect(result.clarificationPrompt).toBeDefined();
    expect(result.clarificationPrompt).toContain('What do the numbers');
    expect(result.clarificationPrompt).toContain('represent');
  });

  // Test L: Real ERP table
  it('L. Real ERP table with multiple subjects and L/T/P/S rows aggregates correctly', () => {
    const erpTable = `
S.No Course Code Course Description LTPS Section Academic Year Semester Fr Date Total Conducted Total Attended Total Absent Tcbr Percentage Attendance Register
1 24CI3201 ADAPTIVE SOFTWARE ENGINEERING L S-5-MA 2026-2027 Odd Sem N 28 26 2 0 93% Register
2 24CI3201 ADAPTIVE SOFTWARE ENGINEERING P S-5-MA 2026-2027 Odd Sem N 24 16 8 0 67% Register
3 24CI3202 CLOUD COMPUTING L S-5-MA 2026-2027 Odd Sem N 30 27 3 0 90% Register
4 24CI3202 CLOUD COMPUTING P S-5-MA 2026-2027 Odd Sem N 20 18 2 0 90% Register
5 24CI3203 PARALLEL COMPUTING L S-5-MA 2026-2027 Odd Sem N 20 18 2 0 90% Register
6 24CI3203 PARALLEL COMPUTING P S-5-MA 2026-2027 Odd Sem N 22 16 6 0 73% Register
7 24CI3204 ENTERPRISE ARCHITECTURE T S-5-MA 2026-2027 Odd Sem N 10 9 1 0 90% Register
8 24CI3205 PROFESSIONAL SKILLS S S-5-MA 2026-2027 Odd Sem N 16 16 0 0 100% Register
`;
    const { summary } = parseAndCalculate(erpTable, defaultSettings);

    // Exactly 5 distinct subjects
    expect(summary.subjectCalculations.length).toBe(5);

    // No fake subjects derived from headers or metadata
    const names = summary.subjectCalculations.map((s) => s.subjectName);
    expect(names.some((n) => /odd\s*sem|register|s\.no|section/i.test(n))).toBe(false);

    // Check Adaptive Software Engineering: L(26/28, wt 1) + P(16/24, wt 0.5) = (26 + 8)/(28 + 12) = 34/40 = 85.00%
    const ase = summary.subjectCalculations.find((s) => s.subjectCode === '24CI3201');
    expect(ase).toBeDefined();
    expect(ase?.components.length).toBe(2);
    expect(ase?.totalAttended).toBe(42);
    expect(ase?.totalConducted).toBe(52);
    expect(ase?.totalWeightedAttended).toBe(34);
    expect(ase?.totalWeightedConducted).toBe(40);
    expect(ase?.formattedPercentage).toBe('85.00%');

    // Check Professional Skills: S(16/16, wt 0.25)
    const skills = summary.subjectCalculations.find((s) => s.subjectCode === '24CI3205');
    expect(skills).toBeDefined();
    expect(skills?.formattedPercentage).toBe('100.00%');
  });

  // Additional Test 1: Tab-delimited (TSV) with Papa Parse
  it('Additional 1: Tab-delimited (TSV) table parsed correctly with Papa Parse', () => {
    const tsv = `Course Code\tCourse Title\tComponent\tConducted\tAttended
CS201\tAlgorithms\tLecture\t30\t26
CS201\tAlgorithms\tPractical\t20\t18
CS202\tComputer Networks\tLecture\t25\t20
`;
    const { summary } = parseAndCalculate(tsv, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(2);
    const algo = summary.subjectCalculations.find((s) => s.subjectCode === 'CS201');
    expect(algo).toBeDefined();
    expect(algo?.components.length).toBe(2);
    // (26*1 + 18*0.5) / (30*1 + 20*0.5) = (26 + 9) / (30 + 10) = 35 / 40 = 87.50%
    expect(algo?.overallPercentage).toBeCloseTo(87.5, 2);
    expect(algo?.formattedPercentage).toBe('87.50%');
  });

  // Additional Test 2: CSV with quotes containing commas via Papa Parse
  it('Additional 2: Comma-delimited (CSV) with quoted cells containing commas', () => {
    const csv = `Course Code,Course Name,Component,Total Conducted,Total Attended
"CS-301","Software Engineering, Advanced",Lecture,28,26
"CS-301","Software Engineering, Advanced",Practical,24,16
"CS-302","Databases, Relational & Distributed",Lecture,30,27
`;
    const { summary } = parseAndCalculate(csv, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(2);
    const se = summary.subjectCalculations.find((s) => s.subjectCode === 'CS-301');
    expect(se?.subjectName).toBe('Software Engineering, Advanced');
    expect(se?.formattedPercentage).toBe('85.00%');
  });

  // Additional Test 3: Repeated component rows merge properly
  it('Additional 3: Repeated rows for the same component merge counts', () => {
    const tableWithRepeatedComponent = `Course Code\tCourse Name\tComponent\tConducted\tAttended
CS101\tOperating Systems\tLecture\t20\t18
CS101\tOperating Systems\tLecture\t10\t8
`;
    const { summary } = parseAndCalculate(tableWithRepeatedComponent, defaultSettings);

    expect(summary.subjectCalculations.length).toBe(1);
    const os = summary.subjectCalculations[0];
    // Repeated lecture rows merged into one Lecture component: attended 18+8=26, conducted 20+10=30
    expect(os.components.length).toBe(1);
    expect(os.totalAttended).toBe(26);
    expect(os.totalConducted).toBe(30);
    expect(os.formattedPercentage).toBe('86.67%');
  });

  // Additional Test 4: Extra whitespace, blank rows, and malformed lines handled cleanly
  it('Additional 4: Extra whitespace and blank rows handled cleanly', () => {
    const messyTable = `

Course Code \t Course Name \t Component \t Conducted \t Attended

CS101 \t Operating Systems \t Lecture \t 30 \t 25

  
CS102 \t Computer Networks \t Lecture \t 28 \t 24

`;
    const { summary } = parseAndCalculate(messyTable, defaultSettings);
    expect(summary.subjectCalculations.length).toBe(2);
    expect(summary.validSubjects).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { parseAndCalculate } from '../engine/pipeline.js';
import { DEFAULT_WEIGHTS, type CalculationSettings } from '../types/attendance.js';

const defaultSettings: CalculationSettings = {
  weights: DEFAULT_WEIGHTS,
  method: 'raw-count',
  targetPercentage: 75,
};

describe('ERP Table Regression Tests', () => {
  // Test Case: Real 15-row ERP attendance table with 8 subjects
  const REAL_ERP_TABLE = `
ACADEMIC YEAR 2026-2027 | SEMESTER V
STUDENT ATTENDANCE REPORT

S.No Course Code Course Description LTPS Section Year Semester Fr Date Total Conducted Total Attended Total Absent Tcbr Percentage Attendance Register
1 24CI3201 ADAPTIVE SOFTWARE ENGINEERING L S-5-MA 2026-2027 Odd Sem N 28 26 2 0 93% Register
2 24CI3201 ADAPTIVE SOFTWARE ENGINEERING P S-5-MA 2026-2027 Odd Sem N 24 16 8 0 67% Register
3 24CI3202 PARALLEL AND DISTRIBUTED COMPUTING L S-5-MA 2026-2027 Odd Sem N 20 18 2 0 90% Register
4 24CI3202 PARALLEL AND DISTRIBUTED COMPUTING P S-5-MA 2026-2027 Odd Sem N 22 16 6 0 73% Register
5 24CI3203 DATA SCIENCE AND MACHINE LEARNING L S-5-MA 2026-2027 Odd Sem N 36 31 5 0 86% Register
6 24CI3203 DATA SCIENCE AND MACHINE LEARNING P S-5-MA 2026-2027 Odd Sem N 22 16 6 0 73% Register
7 24CI3204 INFORMATION AND NETWORK SECURITY L S-5-MA 2026-2027 Odd Sem N 31 26 5 0 84% Register
8 24CI3204 INFORMATION AND NETWORK SECURITY T S-5-MA 2026-2027 Odd Sem N 11 8 3 0 73% Register
9 24CI3205 SERVICE ORIENTED ARCHITECTURE L S-5-MA 2026-2027 Odd Sem N 11 11 0 0 100% Register
10 24CI3205 SERVICE ORIENTED ARCHITECTURE S S-5-MA 2026-2027 Odd Sem N 46 26 20 0 57% Register
11 24CI3206 CLOUD COMPUTING ARCHITECTURE L S-5-MA 2026-2027 Odd Sem N 30 25 5 0 83% Register
12 24CI3206 CLOUD COMPUTING ARCHITECTURE P S-5-MA 2026-2027 Odd Sem N 20 16 4 0 80% Register
13 24CI3207 MOBILE APPLICATION DEVELOPMENT L S-5-MA 2026-2027 Odd Sem N 28 22 6 0 79% Register
14 24CI3207 MOBILE APPLICATION DEVELOPMENT P S-5-MA 2026-2027 Odd Sem N 24 18 6 0 75% Register
15 24CI3208 PROFESSIONAL ETHICS L S-5-MA 2026-2027 Odd Sem N 15 14 1 0 93% Register

PRINTED ON 15-OCT-2024
`;

  it('correctly interprets real ERP table with 15 component rows into 8 subjects', () => {
    const { summary } = parseAndCalculate(REAL_ERP_TABLE, defaultSettings);

    // Must detect exactly 8 subjects (NOT 36!)
    expect(summary.totalSubjects).toBe(8);
    expect(summary.totalComponents).toBe(15);
    expect(summary.validSubjects).toBe(8);
    expect(summary.incompleteSubjects).toBe(0);

    // Must have 0 false warnings
    expect(summary.warnings.length).toBe(0);

    // Subject names must NOT include metadata like "Sem N", "Odd", "Register"
    const names = summary.subjectCalculations.map((s) => s.subjectName.toUpperCase());
    expect(names.some((n) => n.includes('SEM N'))).toBe(false);
    expect(names.some((n) => n.includes('ODD'))).toBe(false);
    expect(names.some((n) => n.includes('REGISTER'))).toBe(false);

    // Check Adaptive Software Engineering (Course Code 24CI3201)
    const ase = summary.subjectCalculations.find((s) => s.subjectCode === '24CI3201');
    expect(ase).toBeDefined();
    expect(ase?.components.length).toBe(2);

    const lec = ase?.components.find((c) => c.type === 'lecture');
    expect(lec).toBeDefined();
    expect(lec?.conducted).toBe(28);
    expect(lec?.attended).toBe(26);
    expect(lec?.absent).toBe(2);

    const prac = ase?.components.find((c) => c.type === 'practical');
    expect(prac).toBeDefined();
    expect(prac?.conducted).toBe(24);
    expect(prac?.attended).toBe(16);
    expect(prac?.absent).toBe(8);

    // Weighted percentage: (26*1 + 16*0.5) / (28*1 + 24*0.5) = 34 / 40 = 85.00%
    expect(ase?.formattedPercentage).toBe('85.00%');

    // Grand attendance percentage must be around 82.34%, NEVER 107.69%!
    expect(summary.grandOverallPercentage).toBeCloseTo(82.34, 1);
    expect(summary.grandOverallPercentage).toBeLessThan(100);
  });

  // Test Case: Wrapped physical lines inside course names and columns
  it('handles multiline wrapped rows without splitting courses or creating false subjects', () => {
    const WRAPPED_ERP_TABLE = `
S.No Course Code Course Description LTPS Section Year Semester Fr Date Total Conducted Total Attended Total Absent Tcbr Percentage Attendance Register
1 24CI3201 ADAPTIVE SOFTWARE
ENGINEERING L
S-5-MA 2026-2027
Odd Sem N 28 26 2 0 93% Register
2 24CI3201 ADAPTIVE SOFTWARE
ENGINEERING P
S-5-MA 2026-2027
Odd Sem N 24 16 8 0 67% Register
3 24CI3202 PARALLEL AND DISTRIBUTED
COMPUTING L
S-5-MA 2026-2027
Odd Sem N 20 18 2 0 90% Register
4 24CI3202 PARALLEL AND DISTRIBUTED
COMPUTING P
S-5-MA 2026-2027
Odd Sem N 22 16 6 0 73% Register
`;

    const { summary } = parseAndCalculate(WRAPPED_ERP_TABLE, defaultSettings);

    // Must detect exactly 2 subjects
    expect(summary.totalSubjects).toBe(2);
    expect(summary.totalComponents).toBe(4);
    expect(summary.warnings.length).toBe(0);

    const ase = summary.subjectCalculations.find((s) => s.subjectCode === '24CI3201');
    expect(ase?.subjectName).toContain('ADAPTIVE SOFTWARE ENGINEERING');
    expect(ase?.formattedPercentage).toBe('85.00%');

    const pdc = summary.subjectCalculations.find((s) => s.subjectCode === '24CI3202');
    expect(pdc?.subjectName).toContain('PARALLEL AND DISTRIBUTED COMPUTING');
    // PDC: (18*1 + 16*0.5) / (20*1 + 22*0.5) = 26 / 31 = 83.87%
    expect(pdc?.formattedPercentage).toBe('83.87%');
  });

  // Test Case: Mixed input (ERP table + natural language note)
  it('correctly processes mixed input containing an ERP table and an informal note', () => {
    const MIXED_INPUT = `
S.No Course Code Course Description LTPS Section Year Semester Fr Date Total Conducted Total Attended Total Absent Tcbr Percentage Attendance Register
1 24CI3201 ADAPTIVE SOFTWARE ENGINEERING L S-5-MA 2026-2027 Odd Sem N 28 26 2 0 93% Register
2 24CI3201 ADAPTIVE SOFTWARE ENGINEERING P S-5-MA 2026-2027 Odd Sem N 24 16 8 0 67% Register

Also, for Deep Learning I attended 18 out of 20 lectures.
`;

    const { summary } = parseAndCalculate(MIXED_INPUT, defaultSettings);

    // Should have 1 from ERP table (ASE) + 1 from natural language (Deep Learning) = 2 subjects
    expect(summary.totalSubjects).toBe(2);

    const dl = summary.subjectCalculations.find((s) => s.subjectName.toLowerCase().includes('deep learning'));
    expect(dl).toBeDefined();
    expect(dl?.formattedPercentage).toBe('90.00%');
  });
});

import { describe, expect, it } from 'vitest';
import { parseAndCalculate, processAttendanceInput } from '../engine/pipeline.js';
import type { CalculationSettings, SubjectRecord } from '../types/attendance.js';
import { DEFAULT_WEIGHTS } from '../types/attendance.js';

const defaultSettings: CalculationSettings = {
  weights: DEFAULT_WEIGHTS,
  method: 'raw-count',
  targetPercentage: 75,
};

describe('Attendly — Parser Audit v3: Fix Real-Input Failures', () => {
  // =========================================================================
  // Case A: Contradictory Counts vs Consistent Counts
  // =========================================================================
  describe('Case A: Contradictory counts vs consistent counts', () => {
    it('Case A.1: "Physics: conducted 32, absent 5, attended 27" is consistent (27 + 5 = 32) and calculates 84.38%', () => {
      const input = 'Physics: conducted 32, absent 5, attended 27';
      const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

      expect(parseResult.intent).toBe('attendance_data');
      expect(summary.subjectCalculations.length).toBe(1);

      const phys = summary.subjectCalculations[0];
      expect(phys.subjectName).toBe('Physics');
      expect(phys.components.length).toBe(1);

      const comp = phys.components[0];
      expect(comp.name).toBe('Lecture');
      expect(comp.attended).toBe(27);
      expect(comp.conducted).toBe(32);
      expect(comp.absent).toBe(5);
      expect(comp.validationStatus).toBe('valid');
      expect(comp.validationReason).toBeUndefined();

      expect(phys.isValid).toBe(true);
      expect(phys.totalAttended).toBe(27);
      expect(phys.totalConducted).toBe(32);
      expect(phys.overallPercentage).toBeCloseTo(84.375, 3);
      expect(phys.formattedPercentage).toBe('84.38%');
      expect(summary.formattedGrandPercentage).toBe('84.38%');
    });

    it('Case A.2: "Physics: conducted 32, absent 5, attended 29" is contradictory (29 + 5 = 34 !== 32), preserves values, marks invalid, and yields N/A', () => {
      const input = 'Physics: conducted 32, absent 5, attended 29';
      const { parseResult, summary } = parseAndCalculate(input, defaultSettings);

      expect(parseResult.intent).toBe('attendance_data');
      expect(summary.subjectCalculations.length).toBe(1);

      const phys = summary.subjectCalculations[0];
      expect(phys.components.length).toBe(1);

      const comp = phys.components[0];
      // Values preserved strictly without silent swapping or mutation
      expect(comp.attended).toBe(29);
      expect(comp.conducted).toBe(32);
      expect(comp.absent).toBe(5);
      expect(comp.validationStatus).toBe('invalid');
      expect(comp.validationReason).toContain('Contradicting numbers');
      expect(comp.validationReason).toContain('34');

      // Invalid component excluded from trusted totals
      expect(phys.isValid).toBe(false);
      expect(phys.totalAttended).toBe(0);
      expect(phys.totalConducted).toBe(0);
      expect(phys.overallPercentage).toBeNull();
      expect(phys.formattedPercentage).toBe('N/A');
      expect(summary.grandOverallPercentage).toBeNull();
      expect(summary.formattedGrandPercentage).toBe('N/A');
      expect(summary.invalidComponentsCount).toBe(1);
    });
  });

  // =========================================================================
  // Case B: Conversational Text Must Not Create Subjects
  // =========================================================================
  describe('Case B: Conversational text must not create subjects', () => {
    it('Case B.1: "My target is 85% and Physics is my hardest subject." creates 0 subjects and mutates nothing', () => {
      const input = 'My target is 85% and Physics is my hardest subject.';

      // Empty existing state
      const run1 = processAttendanceInput(input, defaultSettings, []);
      expect(run1.intent).toBe('conversational');
      expect(run1.subjects.length).toBe(0);
      expect(run1.warnings.length).toBe(0); // No misleading validation warnings like "no components"
      expect(run1.clarificationPrompt).toBeDefined();
      expect(run1.clarificationPrompt).toContain('No actionable attendance data detected');

      // With existing subjects: existing state is strictly preserved
      const existingSubjects: SubjectRecord[] = [
        {
          id: 'sub-existing-1',
          name: 'Mathematics',
          components: [
            {
              id: 'comp-math-1',
              type: 'lecture',
              name: 'Lecture',
              attended: 25,
              conducted: 30,
              absent: 5,
              weight: 1.0,
              confidence: 'high',
              validationStatus: 'valid',
            },
          ],
        },
      ];

      const run2 = processAttendanceInput(input, defaultSettings, existingSubjects);
      expect(run2.intent).toBe('conversational');
      expect(run2.subjects.length).toBe(1);
      expect(run2.subjects[0].name).toBe('Mathematics');
      expect(run2.subjects[0].components[0].attended).toBe(25);
    });

    it('Case B.2: Other conversational statements do not create fake subjects', () => {
      const conversationalInputs = [
        'Hello, can you help me with my classes?',
        'Attendance policy requires 75% minimum attendance.',
        'Physics is my favorite subject this term.',
        'I am worried about my grades.',
      ];

      for (const phrase of conversationalInputs) {
        const res = processAttendanceInput(phrase, defaultSettings, []);
        expect(res.intent).toBe('conversational');
        expect(res.subjects.length).toBe(0);
        expect(res.warnings.length).toBe(0);
      }
    });
  });

  // =========================================================================
  // Case C: Strip Status Language from Subject Names
  // =========================================================================
  describe('Case C: Strip status language from subject names', () => {
    it('Case C.1: "Deep Learning - attended 27/32" extracts "Deep Learning", Lecture 27/32, 84.38%', () => {
      const input = 'Deep Learning - attended 27/32';
      const { summary } = parseAndCalculate(input, defaultSettings);

      expect(summary.subjectCalculations.length).toBe(1);
      const sub = summary.subjectCalculations[0];
      expect(sub.subjectName).toBe('Deep Learning');
      expect(sub.components.length).toBe(1);

      const comp = sub.components[0];
      expect(comp.name).toBe('Lecture');
      expect(comp.attended).toBe(27);
      expect(comp.conducted).toBe(32);
      expect(comp.absent).toBe(5);
      expect(sub.overallPercentage).toBeCloseTo(84.375, 3);
      expect(sub.formattedPercentage).toBe('84.38%');
    });

    it('Case C.2: Other dash-separated and status-annotated phrases', () => {
      const input1 = 'Operating Systems - conducted 30, attended 25';
      const { summary: s1 } = parseAndCalculate(input1, defaultSettings);
      expect(s1.subjectCalculations[0].subjectName).toBe('Operating Systems');
      expect(s1.subjectCalculations[0].totalAttended).toBe(25);
      expect(s1.subjectCalculations[0].totalConducted).toBe(30);

      const input2 = 'Mathematics: attended 20/25';
      const { summary: s2 } = parseAndCalculate(input2, defaultSettings);
      expect(s2.subjectCalculations[0].subjectName).toBe('Mathematics');
      expect(s2.subjectCalculations[0].totalAttended).toBe(20);
      expect(s2.subjectCalculations[0].totalConducted).toBe(25);
    });

    it('Case C.3: Preserve legitimate subject names that contain hyphens or similar words', () => {
      const input1 = 'Applied Theory: 18/20';
      const { summary: s1 } = parseAndCalculate(input1, defaultSettings);
      expect(s1.subjectCalculations[0].subjectName).toBe('Applied Theory');

      const input2 = 'Hands-on Robotics - 15/18';
      const { summary: s2 } = parseAndCalculate(input2, defaultSettings);
      expect(s2.subjectCalculations[0].subjectName).toBe('Hands-on Robotics');

      const input3 = 'MAT-102 - attended 28/30';
      const { summary: s3 } = parseAndCalculate(input3, defaultSettings);
      expect(s3.subjectCalculations[0].subjectName).toBe('MAT-102');
      expect(s3.subjectCalculations[0].totalAttended).toBe(28);
      expect(s3.subjectCalculations[0].totalConducted).toBe(30);
    });
  });

  // =========================================================================
  // Case D: Ambiguous Number Sequences
  // =========================================================================
  describe('Case D: Ambiguous number sequences', () => {
    it('Case D.1: "The numbers are 20, 18 and 2." creates no subjects, mutates nothing, requests clarification', () => {
      const input = 'The numbers are 20, 18 and 2.';
      const res = processAttendanceInput(input, defaultSettings, []);

      expect(res.intent).toBe('ambiguous');
      expect(res.subjects.length).toBe(0);
      expect(res.clarificationPrompt).toBeDefined();
      expect(res.clarificationPrompt).toContain('What do the numbers (20, 18, 2) represent');
      expect(res.warnings.some((w) => w.type === 'ambiguous_values')).toBe(true);
    });

    it('Case D.2: "I missed 5 lec n 7 prac" creates no subjects and asks which subject absences belong to and conducted count', () => {
      const input = 'I missed 5 lec n 7 prac';
      const res = processAttendanceInput(input, defaultSettings, []);

      expect(res.intent).toBe('ambiguous');
      expect(res.subjects.length).toBe(0);
      expect(res.clarificationPrompt).toBeDefined();
      expect(res.clarificationPrompt).toContain('Which subject do these absences belong to');
      expect(res.clarificationPrompt).toContain('how many classes were conducted');
    });
  });

  // =========================================================================
  // Case E: Duplicate Component Handling
  // =========================================================================
  describe('Case E: Duplicate component handling', () => {
    it('Case E.1: Submitting "Maths: lecture 19/20" when "Maths: lecture 24/30" exists flags duplicate without double counting or silent overwrite', () => {
      // Step 1: Initial submission
      const step1 = processAttendanceInput('Maths: lecture 24/30', defaultSettings, []);
      expect(step1.subjects.length).toBe(1);
      expect(step1.subjects[0].components[0].attended).toBe(24);
      expect(step1.subjects[0].components[0].conducted).toBe(30);

      // Step 2: Next submission with differing counts for same component
      const step2 = processAttendanceInput('Maths: lecture 19/20', defaultSettings, step1.subjects);

      expect(step2.subjects.length).toBe(1);
      const maths = step2.subjects[0];
      // Does not create two separate lecture components (not double-counted as 43/50)
      expect(maths.components.length).toBe(1);

      // Preserves existing record safely without silent overwrite
      expect(maths.components[0].attended).toBe(24);
      expect(maths.components[0].conducted).toBe(30);

      // Flags potential_duplicate warning with action options
      const dupWarning = step2.warnings.find((w) => w.type === 'potential_duplicate');
      expect(dupWarning).toBeDefined();
      expect(dupWarning?.message).toContain('Potential duplicate detected for "Maths"');
      expect(dupWarning?.message).toContain('24/30 vs 19/20');
      expect(dupWarning?.suggestedAction).toContain('Confirm whether the second entry replaces the first');
    });

    it('Case E.2: Duplicate components within the same input text flag warning without double counting', () => {
      const input = `Maths: lecture 24/30
Maths: lecture 19/20`;

      const { summary } = parseAndCalculate(input, defaultSettings);
      expect(summary.subjectCalculations.length).toBe(1);
      const maths = summary.subjectCalculations[0];

      // Excludes duplicate from double-counting
      expect(maths.components.length).toBe(1);
      expect(maths.totalConducted).toBe(30);
      expect(maths.totalAttended).toBe(24);
      expect(summary.warnings.some((w) => w.type === 'potential_duplicate')).toBe(true);
    });
  });

  // =========================================================================
  // Case F: Typo Tolerance and Weighted Calculations
  // =========================================================================
  describe('Case F: Typo tolerance and weighted calculations', () => {
    it('Case F.1: "OS: 27/32 lectuer, 9/12 practcal" calculates strictly 82.89%', () => {
      const input = 'OS: 27/32 lectuer, 9/12 practcal';
      const { summary } = parseAndCalculate(input, defaultSettings);

      const os = summary.subjectCalculations[0];
      const lec = os.components.find((c) => c.type === 'lecture');
      const prac = os.components.find((c) => c.type === 'practical');

      expect(lec?.weight).toBe(1.0);
      expect(prac?.weight).toBe(0.5);

      // Formula: (27*1 + 9*0.5) / (32*1 + 12*0.5) * 100 = 31.5 / 38 * 100 = 82.8947...% -> 82.89%
      expect(os.totalWeightedAttended).toBe(31.5);
      expect(os.totalWeightedConducted).toBe(38);
      expect(os.formattedPercentage).toBe('82.89%');
      expect(summary.formattedGrandPercentage).toBe('82.89%');

      // Reject unweighted average (81.82%) and percentage average (79.69%)
      expect(os.formattedPercentage).not.toBe('81.82%');
      expect(os.formattedPercentage).not.toBe('79.69%');
    });

    it('Case F.2: "Physics: 20/25 lectre, 8/10 practicle" supports typos "lectre" and "practicle"', () => {
      const input = 'Physics: 20/25 lectre, 8/10 practicle';
      const { summary } = parseAndCalculate(input, defaultSettings);

      const phys = summary.subjectCalculations[0];
      const lec = phys.components.find((c) => c.type === 'lecture');
      const prac = phys.components.find((c) => c.type === 'practical');

      expect(lec).toBeDefined();
      expect(prac).toBeDefined();
      expect(lec?.weight).toBe(1.0);
      expect(prac?.weight).toBe(0.5);

      // (20*1 + 8*0.5) / (25*1 + 10*0.5) * 100 = 24 / 30 * 100 = 80.00%
      expect(phys.formattedPercentage).toBe('80.00%');
    });
  });

  // =========================================================================
  // Adversarial Variations
  // =========================================================================
  describe('Adversarial variations', () => {
    it('Adversarial 1: Extra whitespace, capitalization, line breaks', () => {
      const input = '\n\n   cOmPuTeR nEtWoRkS   :   22 / 28   lEcTuRe  ,   11 / 14   PrAcTcAl   \n\n';
      const { summary } = parseAndCalculate(input, defaultSettings);

      expect(summary.subjectCalculations.length).toBe(1);
      const sub = summary.subjectCalculations[0];
      expect(sub.subjectName.toLowerCase()).toBe('computer networks');
      expect(sub.components.length).toBe(2);
      expect(sub.isValid).toBe(true);
    });

    it('Adversarial 2: Numbers in ordinary prose do not create subjects', () => {
      const input = 'I walked 3 miles to class and bought 2 books.';
      const res = processAttendanceInput(input, defaultSettings, []);

      expect(res.intent).toBe('conversational');
      expect(res.subjects.length).toBe(0);
    });

    it('Adversarial 3: Valid attendance record followed by unrelated prose', () => {
      const input = 'Physics: 24/30. My target is 85% and Physics is my hardest subject.';
      const { summary } = parseAndCalculate(input, defaultSettings);

      // Exactly 1 subject is created (Physics); no fake second subject from conversational prose
      expect(summary.subjectCalculations.length).toBe(1);
      const phys = summary.subjectCalculations[0];
      expect(phys.subjectName).toBe('Physics');
      expect(phys.totalAttended).toBe(24);
      expect(phys.totalConducted).toBe(30);
      expect(phys.formattedPercentage).toBe('80.00%');
    });

    it('Adversarial 4: Multiple subjects in one input with mixed punctuation', () => {
      const input = 'Deep Learning - attended 27/32; Algorithms: 24/30; Math - 19/20 lec';
      const { summary } = parseAndCalculate(input, defaultSettings);

      expect(summary.subjectCalculations.length).toBe(3);
      const dl = summary.subjectCalculations.find((s) => s.subjectName === 'Deep Learning');
      const algo = summary.subjectCalculations.find((s) => s.subjectName === 'Algorithms');
      const math = summary.subjectCalculations.find((s) => s.subjectName === 'Math');

      expect(dl?.totalAttended).toBe(27);
      expect(algo?.totalAttended).toBe(24);
      expect(math?.totalAttended).toBe(19);
    });

    it('Adversarial 5: Standalone single ratio creates General Attendance record', () => {
      const input = '24/30';
      const { summary } = parseAndCalculate(input, defaultSettings);

      expect(summary.subjectCalculations.length).toBe(1);
      expect(summary.subjectCalculations[0].subjectName).toBe('General Attendance');
      expect(summary.subjectCalculations[0].formattedPercentage).toBe('80.00%');
    });
  });
});

export interface SamplePreset {
  id: string;
  title: string;
  description: string;
  text: string;
}

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'erp-table',
    title: 'University ERP Table',
    description: 'Realistic 15-component ERP register for 8 subjects with LTPS and metadata',
    text: `ACADEMIC YEAR 2026-2027 | SEMESTER V
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

PRINTED ON 15-OCT-2024`,
  },
  {
    id: 'conversational',
    title: 'Conversational English',
    description: 'Natural language sentences copied or typed casually',
    text: `ASE lecture 26 attended out of 28 and practical 16 out of 24. PDC theory 18/20, lab 16 attended from 22. Data science I went to 31 classes out of 36 lectures, practicals 16 out of 22. For IAS theory 26 of 31 and tutorial 8 from 11. I have Deep Learning, but I haven't entered the practical attendance yet.`,
  },
  {
    id: 'shorthand',
    title: 'Compact Shorthand',
    description: 'Quick shorthand notes using L, P, T, S abbreviations',
    text: `ASE L 26 28 P 16 24, PDC L 18 20 P 16 22, DL lecture 31/34 and practical 12/24, SOA theory 11/11 skill 26/46`,
  },
  {
    id: 'mixed',
    title: 'Informal & Punctuation Mix',
    description: 'Mixed sentences, absent counts, and course codes',
    text: `In CS301 Adaptive Software Engineering, I missed 2 of the 28 classes in lecture, and practical is 16/24.
PDC practicals are 16 out of 22, lectures 18 out of 20.
All 25 lectures attended in Database Systems.
Robotics theory 0 attended out of 0.`,
  },
];

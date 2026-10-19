import type { InputIntent } from '../types/attendance.js';
import { isStructuredERPRegister } from './erpTableParser.js';
import { detectTableStructure } from './tableDetector.js';

const QUESTION_PATTERNS = [
  /^(?:can\s+you\s+)?(?:please\s+)?(?:what\s+is|what's|how\s+much\s+is|show\s+me|tell\s+me|get|calculate|compute|work\s+out)\s+(?:the\s+|my\s+|overall\s+)?attendance(?:\s+(?:in|for|of)\s+[A-Za-z0-9\s-]+)?(?:\s+for\s+me)?(?:\s*,?\s*please)?\??$/i,
  /^(?:what\s+is|what's)\s+my\s+(?:[A-Za-z0-9\s-]+\s+)?attendance(?:\s*,?\s*please)?\??$/i,
  /^calculate\s+my\s+(?:[A-Za-z0-9\s-]+\s+)?attendance(?:\s*,?\s*please)?\??$/i,
  /^work\s+out\s+(?:the\s+)?(?:[A-Za-z0-9\s-]+\s+)?attendance(?:\s*,?\s*please)?\??$/i,
  /^can\s+you\s+calculate\s+my\s+(?:[A-Za-z0-9\s-]+\s+)?attendance(?:\s*,?\s*please)?\??$/i,
  /^what\s+(?:is|are|was|were)\s+(?:the\s+|my\s+)?(?:[A-Za-z0-9\s-]+\s+)?attendance(?:\s*,?\s*please)?\??$/i,
  /^(?:is|will)\s+my\s+(?:[A-Za-z0-9\s-]+\s+)?attendance\s+(?:good|safe|above|enough|okay|fine)(?:\s*,?\s*please)?\??$/i,
  /^can\s+i\s+bunk(?:\s+any\s+classes)?(?:\s*,?\s*please)?\??$/i,
];

const PROJECTION_PATTERNS = [
  /how\s+many\s+(?:more\s+)?(?:consecutive\s+)?classes\s+(?:do|must)\s+I\s+(?:need\s+to\s+)?attend/i,
  /how\s+many\s+(?:more\s+)?classes/i,
  /what\s+will\s+my\s+attendance\s+be/i,
  /what\s+happens\s+if\s+I\s+(?:skip|miss|bunk)/i,
  /if\s+I\s+(?:skip|miss|bunk)\s+(?:the\s+next\s+)?\d+/i,
  /if\s+I\s+attend\s+\d+\s+more\s+classes/i,
  /there\s+are\s+\d+\s+more\s+classes/i,
  /(?:and\s+)?will\s+attend\s+(?:the\s+next\s+)?\d+/i,
  /(?:and\s+)?will\s+(?:miss|skip|bunk)\s+(?:the\s+next\s+)?\d+/i,
  /(?:and\s+)?will\s+(?:be\s+able\s+to\s+)?attend\s+\d+/i,
];

// Unanchored absence statements: e.g. "I missed 5 lec and 7 prac", "missed 5 lectures"
const UNANCHORED_ABSENCE_PATTERN =
  /^(?:i\s+)?(?:missed|bunked|skipped|was\s+absent\s+(?:for|in))\s+\d+\s*(?:lec|lecs|lectuer|lectuers|lectre|lecture|lectures|tut|tuts|tutorial|tutorials|prac|pracs|practcal|practical|practicals|classes|labs|skls?|skills?)(?:\s*(?:and|&|n|,)\s*\d+\s*(?:lec|lecs|lectuer|lectuers|lectre|lecture|lectures|tut|tuts|tutorial|tutorials|prac|pracs|practcal|practical|practicals|classes|labs|skls?|skills?))*\.?$/i;

// Bare numbers without relationships: e.g. "Networks 20, 18, 2", "Networks: 20, 18, 2", "the numbers are 20, 18 and 2"
const BARE_NUMBERS_PATTERN =
  /^(?:[A-Za-z0-9\s-]+(?::\s*|\s+))?(?:(?:the\s+)?numbers?\s+are\s+)?\d+[,\s]+\d+[,\s]+(?:and\s+)?\d+\.?$/i;

/**
 * Checks whether text contains actionable attendance count indicators
 * (ratios, out-of fractions, labeled counts, LTPS shorthand, etc.).
 */
export function hasActionableAttendanceData(text: string): boolean {
  // 1. Ratio format (e.g. 24/30, 27/32, 19/20, 0/0)
  if (/\b\d+\s*\/\s*\d+\b/.test(text)) return true;

  // 2. Out-of format (e.g. 26 out of 28, 26 of 28, 16 from 24)
  if (/\b\d+\s*(?:classes|lectures|practicals|sessions|labs)?\s*(?:attended\s+)?(?:out\s+of|of|from)\s*\d+\b/i.test(text)) return true;

  // 3. Labeled conducted, attended, or absent counts
  const hasConducted =
    /\b(?:conducted|conductd|held|taken|total)\s*[:=]?\s*\d+\b/i.test(text) ||
    /\b\d+\s*(?:classes|lectures|practicals|sessions|labs)?\s*(?:conducted|conductd|held|taken|total)\b/i.test(text);

  const hasAttended =
    /\b(?:attended|attnded|present)\s*[:=]?\s*\d+\b/i.test(text) ||
    /\b\d+\s*(?:classes|lectures|practicals|sessions|labs)?\s*(?:attended|attnded|present)\b/i.test(text);

  const hasAbsent =
    /\b(?:absent|absnt|missed|skipped)\s*[:=]?\s*\d+\b/i.test(text) ||
    /\b\d+\s*(?:classes|lectures|practicals|sessions|labs)?\s*(?:absent|absnt|missed|skipped)\b/i.test(text);

  if (hasConducted && (hasAttended || hasAbsent)) return true;
  if (hasAttended && hasAbsent) return true;

  // Single labeled count after a subject colon/dash: e.g. "Physics: conducted 32", "Deep Learning - attended 27/32"
  if (/\b[A-Za-z0-9\s-]{2,30}\s*[:\-–—]\s*(?:attended|conducted|present)\s*\d+/i.test(text)) return true;

  // 4. Shorthand component letter with counts: e.g. "L 26 28", "P 16 24", "L 18/20"
  if (/\b[LTPSltps]\s*[:=]?\s*\d+\s+\d+\b/.test(text)) return true;
  if (/\b[LTPSltps]\s*[:=]?\s*\d+\s*\/\s*\d+\b/.test(text)) return true;

  // 5. Subject name or course code followed by two numbers: e.g. "ASE 26 28", "Maths 24 30", "CS101 24 30"
  if (/\b[A-Za-z][A-Za-z0-9\s-]{1,25}\s*[:\-–—]?\s*\d+\s+\d+\b/.test(text)) {
    return true;
  }

  // 6. Delimited table structure
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length >= 2 && detectTableStructure(lines).isTable) return true;

  return false;
}

/**
 * Classifies raw user input into an explicit intent:
 * - attendance_data: sufficiently clear subject and attendance component data
 * - question: a question about attendance or required future attendance
 * - projection: a hypothetical future calculation
 * - conversational: ordinary statements that do not contain actionable attendance records
 * - ambiguous: possible attendance-related text missing essential information
 * - erp_table: structured tabular attendance data
 * - empty: blank input
 */
export function classifyInputIntent(rawInput: string): InputIntent {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return 'empty';
  }

  // 1. Structured ERP table or spreadsheet table
  if (isStructuredERPRegister(trimmed)) {
    return 'erp_table';
  }
  const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length >= 2) {
    const tableInfo = detectTableStructure(lines);
    if (tableInfo.isTable) {
      return 'erp_table';
    }
  }

  // 2. Pure questions or commands about attendance (without data to import)
  for (const qPattern of QUESTION_PATTERNS) {
    if (qPattern.test(trimmed)) {
      return 'question';
    }
  }

  // 3. Projections and hypothetical scenarios
  for (const pPattern of PROJECTION_PATTERNS) {
    if (pPattern.test(trimmed)) {
      return 'projection';
    }
  }

  // 4. Standalone ambiguous statement (unanchored absences or bare numbers without relationships)
  if (UNANCHORED_ABSENCE_PATTERN.test(trimmed) || BARE_NUMBERS_PATTERN.test(trimmed)) {
    return 'ambiguous';
  }

  // 5. Verify whether input actually contains actionable attendance data
  if (!hasActionableAttendanceData(trimmed)) {
    return 'conversational';
  }

  return 'attendance_data';
}

import type {
  ComponentRecord,
  ComponentType,
  ParsingWarning,
  SubjectRecord,
} from '../types/attendance.js';
import { formatComponentName } from './componentDetector.js';

interface RawERPRecord {
  courseCode: string;
  courseTitle: string;
  componentType: ComponentType;
  componentName: string;
  conducted: number;
  attended: number;
  absent: number;
  percentage?: number;
  rawText: string;
}

/**
 * Checks if the text contains a structured university ERP table.
 */
export function isStructuredERPRegister(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  // Check 1: Numbered records starting with serial number and course code: e.g. "1 24CI3201"
  const numberedMatch = text.match(/(?:^|\n)\s*(\d+)\s+([0-9]{2}[A-Z]{2,4}[0-9]{2,4}[A-Z]?|[A-Z]{2,5}-?[0-9]{2,5}[A-Z]?)\b/);
  const hasLTPS =
    /\bLTPS\b/i.test(text) ||
    /\b(?:Odd\s+Sem|Even\s+Sem|Sem|Register)\b/i.test(text) ||
    (/\b(?:Lecture|Practical|Tutorial|Skill|L|P|T|S)\b/i.test(text) && /\b\d+\.\d{2}\b/.test(text));

  if (numberedMatch && hasLTPS) {
    return true;
  }

  // Check 2: Sequential numbered records: "1 <code1> ... 2 <code2>"
  const recordMatches = text.match(/(?:^|\n)\s*\d+\s+(?:[0-9]{2}[A-Z]{2,4}[0-9]{2,4}[A-Z]?|[A-Z]{2,5}-?[0-9]{2,5}[A-Z]?)\b/g);
  if (recordMatches && recordMatches.length >= 2) {
    return true;
  }

  return false;
}

/**
 * Parses full university ERP table text, properly handling multiline wrapped rows,
 * grouping multiple components into their course code, and calculating accurate counts.
 */
export function parseStructuredERPRegister(
  text: string,
  weights: Record<ComponentType, number>
): {
  subjects: SubjectRecord[];
  warnings: ParsingWarning[];
  tableRange: { start: number; end: number } | null;
} {
  const warnings: ParsingWarning[] = [];

  // Match all record starts: e.g. "1 24CI3201", "2 24CI3201", "3 24CI3202", ..., "15 24CI3208"
  const recordHeaderRegex = /(?:^|\n)\s*(\d+)\s+([0-9]{2}[A-Z]{2,4}[0-9]{2,4}[A-Z]?|[A-Z]{2,5}-?[0-9]{2,5}[A-Z]?)\b/g;
  const recordStarts: { index: number; serial: number; code: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = recordHeaderRegex.exec(text)) !== null) {
    recordStarts.push({
      index: match.index,
      serial: parseInt(match[1], 10),
      code: match[2],
    });
  }

  if (recordStarts.length === 0) {
    return { subjects: [], warnings: [], tableRange: null };
  }

  const tableStart = recordStarts[0].index;
  let tableEnd = text.length;

  const rawRecords: RawERPRecord[] = [];

  for (let i = 0; i < recordStarts.length; i++) {
    const cur = recordStarts[i];
    const next = recordStarts[i + 1];
    const startPos = cur.index;
    let endPos = next ? next.index : text.length;

    // For the last record, find where this record terminates
    if (!next) {
      const remaining = text.substring(startPos);
      // Match through the numeric tail (conducted, attended, absent, percentage) and optional register token
      const tailEndMatch = remaining.match(/^(?:[\s\S]*?)(?:\b\d+\s+\d+(?:\s+\d+)?(?:\s+\d+)?\s+\d+(?:\.\d+)?%?(?:\s+(?:Register|Registered|View|Action|Details))?)(?:\s*(?:\r?\n|$))/i);
      if (tailEndMatch) {
        endPos = startPos + tailEndMatch[0].length;
      } else {
        const doubleNewline = remaining.search(/\r?\n\s*\r?\n/);
        if (doubleNewline !== -1) {
          endPos = startPos + doubleNewline;
        }
      }
    }

    tableEnd = endPos;
    const chunk = text.substring(startPos, endPos).trim();
    const record = parseERPRecordChunk(chunk, cur.code);
    if (record) {
      rawRecords.push(record);
    }
  }

  // Group raw components into subjects by course code
  const subjectMap = new Map<string, SubjectRecord>();

  for (const rec of rawRecords) {
    const codeKey = rec.courseCode.toUpperCase();
    let subject = subjectMap.get(codeKey);

    if (!subject) {
      subject = {
        id: `subj-${codeKey}`,
        name: rec.courseTitle,
        code: rec.courseCode,
        components: [],
        rawTextSnippet: rec.rawText,
      };
      subjectMap.set(codeKey, subject);
    } else {
      // Use longer title if available
      if (rec.courseTitle.length > subject.name.length) {
        subject.name = rec.courseTitle;
      }
    }

    const effectiveWeight = weights[rec.componentType] ?? 1.0;

    const componentRecord: ComponentRecord = {
      id: `comp-${rec.courseCode}-${rec.componentType}-${subject.components.length + 1}`,
      type: rec.componentType,
      name: rec.componentName,
      attended: rec.attended,
      conducted: rec.conducted,
      absent: rec.absent,
      percentage: rec.percentage,
      weight: effectiveWeight,
      confidence: 'high',
      sourceSnippet: rec.rawText,
    };

    subject.components.push(componentRecord);
  }

  return {
    subjects: Array.from(subjectMap.values()),
    warnings,
    tableRange: { start: tableStart, end: tableEnd },
  };
}

/**
 * Parses an individual ERP record chunk, token-by-token.
 */
function parseERPRecordChunk(chunk: string, expectedCode: string): RawERPRecord | null {
  // Collapse line breaks and multiple spaces into single space
  const singleLine = chunk.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!singleLine) return null;

  const tokens = singleLine.split(/\s+/);
  if (tokens.length < 5) return null;

  // Token 0: Serial number (e.g. "1")
  // Token 1: Course Code (e.g. "24CI3201")
  let codeIdx = tokens.findIndex((t) => t.toUpperCase() === expectedCode.toUpperCase());
  if (codeIdx === -1) codeIdx = 1; // Default to index 1

  // Extract from the tail:
  // e.g. "... 28 26 2 0 93% Register" or "... 28 26 2 93%"
  let tailTokens = [...tokens.slice(codeIdx + 1)];

  // Strip trailing action tokens like "Register", "View", "Action", "Details", "Y", "N"
  if (tailTokens.length > 0 && /^(?:register|registered|view|action|details|y|n|yes|no)$/i.test(tailTokens[tailTokens.length - 1])) {
    tailTokens.pop();
  }

  // Look for percentage at the tail: e.g. "93%" or "92.86"
  let percentage: number | undefined;
  if (tailTokens.length > 0 && /^\d+(?:\.\d+)?%?$/.test(tailTokens[tailTokens.length - 1])) {
    percentage = parseFloat(tailTokens[tailTokens.length - 1].replace('%', ''));
    tailTokens.pop();
  }

  // Collect attendance numbers preceding the percentage:
  // Usually: Total Conducted, Total Attended, Total Absent, [Tcbr]
  // We collect numeric tokens from right to left
  const numericTail: number[] = [];
  while (tailTokens.length > 0 && /^\d+$/.test(tailTokens[tailTokens.length - 1])) {
    numericTail.unshift(parseInt(tailTokens.pop()!, 10));
    // Stop after collecting at most 4 numbers (Tcbr, Absent, Attended, Conducted)
    if (numericTail.length === 4) break;
  }

  let conducted = 0;
  let attended = 0;
  let absent = 0;

  if (numericTail.length >= 3) {
    // ERP table columns strictly map to: [Total Conducted, Total Attended, Total Absent, (Tcbr)]
    conducted = numericTail[0];
    attended = numericTail[1];
    absent = numericTail[2];
  } else if (numericTail.length === 2) {
    conducted = numericTail[0];
    attended = numericTail[1];
    absent = 0;
  } else if (numericTail.length === 1) {
    conducted = numericTail[0];
    attended = numericTail[0];
    absent = 0;
  }

  // Never silently swap attended and conducted if attended > conducted.
  // The shared validator will properly mark the record as invalid and raise a warning.

  // Now remaining tokens in tailTokens contain:
  // [Course Description words..., LTPS, Section, Year, Semester, Fr, Date...]
  // Example: ["ADAPTIVE", "SOFTWARE", "ENGINEERING", "L", "S-5-MA", "2026-2027", "Odd", "Sem", "N"]
  let compType: ComponentType = 'lecture';
  let compName = 'Lecture';
  let ltpIndex = -1;

  for (let t = 0; t < tailTokens.length; t++) {
    const tok = tailTokens[t].toUpperCase();
    if (tok === 'L' || tok === 'LECTURE' || tok === 'THEORY') {
      compType = 'lecture';
      compName = 'Lecture';
      ltpIndex = t;
      break;
    } else if (tok === 'P' || tok === 'PRACTICAL' || tok === 'LAB') {
      compType = 'practical';
      compName = 'Practical';
      ltpIndex = t;
      break;
    } else if (tok === 'T' || tok === 'TUTORIAL') {
      compType = 'tutorial';
      compName = 'Tutorial';
      ltpIndex = t;
      break;
    } else if (tok === 'S' || tok === 'SKILL') {
      compType = 'skill';
      compName = 'Skill';
      ltpIndex = t;
      break;
    }
  }

  let courseTitleWords: string[] = [];
  if (ltpIndex > 0) {
    // All tokens before LTPS are the course title!
    courseTitleWords = tailTokens.slice(0, ltpIndex);
  } else {
    // If no explicit LTPS token, exclude metadata tokens like Section, Year, Odd, Sem, N
    for (const tok of tailTokens) {
      if (/^(?:S-\w+|SEC-\w+|\d{4}-\d{4}|Odd|Even|Sem|N|Y)$/i.test(tok)) {
        break;
      }
      courseTitleWords.push(tok);
    }
  }

  let courseTitle = courseTitleWords.join(' ').replace(/[-–—]\s*$/, '').trim();
  if (!courseTitle) {
    courseTitle = expectedCode;
  }

  return {
    courseCode: expectedCode,
    courseTitle,
    componentType: compType,
    componentName: compName || formatComponentName(compType),
    conducted,
    attended,
    absent,
    percentage,
    rawText: singleLine,
  };
}

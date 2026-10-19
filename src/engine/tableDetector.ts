import Papa from 'papaparse';
import type { ComponentRecord, ComponentType, SubjectRecord } from '../types/attendance.js';
import { detectComponentType, formatComponentName } from './componentDetector.js';
import { COURSE_CODE_REGEX, isValidSubjectName } from './subjectDetector.js';

export interface ColumnMapping {
  codeCol?: number;
  nameCol?: number;
  componentCol?: number;
  conductedCol?: number;
  attendedCol?: number;
  absentCol?: number;
  percentCol?: number;
  ignoreCols: Set<number>;
}

export const HEADER_KEYWORDS = {
  code: [/^(?:course\s*code|subject\s*code|code|paper\s*code|course\s*id|subject\s*id|course\s*no\.?)$/i],
  name: [/^(?:course\s*(?:name|title|desc(?:ription)?)|subject\s*(?:name|title|desc(?:ription)?)?|course|subject|paper\s*name|module\s*(?:name|title)?)$/i],
  component: [/^(?:component|component\s*type|type|course\s*type|category|session\s*type|ltps)$/i],
  conducted: [/^(?:conducted|held|classes\s*held|total\s*(?:classes|hours|sessions)?|total\s*conducted|delivered|taken|max\s*classes)$/i],
  attended: [/^(?:attended|present|classes\s*attended|total\s*attended|attended\s*classes|classes\s*present)$/i],
  absent: [/^(?:absent|missed|classes\s*absent|total\s*absent)$/i],
  percent: [/^(?:%|percent|att\s*%|attendance\s*%|percentage)$/i],
  ignore: [/^(?:s\.?\s*no\.?|sl\.?\s*no\.?|#|no\.?|section|sec|group|grp|faculty|teacher|semester|sem|odd\s*sem|even\s*sem|register|registered|credits?|fr|date|tcbr|action|status|academic\s*year)$/i],
};

/**
 * Splits a table row into cells using Papa Parse for delimited lines (tab/comma/semicolon),
 * or pipe/multi-space splitting for formatting fallbacks.
 */
export function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // If line contains tabs, commas, or semicolons, use Papa Parse for robust RFC-4180 parsing with quotes
  if (line.includes('\t') || line.includes(';') || (line.includes(',') && !/\b(?:out\s+of|attended\s+out|went\s+to|I\s+attended|conducted\s+\d+,\s*absent\s+\d+)\b/i.test(line))) {
    const parseRes = Papa.parse<string[]>(line, {
      skipEmptyLines: false,
    });
    if (parseRes.data.length > 0 && parseRes.data[0].length >= 2) {
      return parseRes.data[0].map((c) => (c ?? '').trim());
    }
  }

  // If line contains pipes (e.g. markdown table)
  if (line.includes('|')) {
    return line
      .split('|')
      .map((c) => c.trim())
      .filter((c, idx, arr) => {
        if ((idx === 0 || idx === arr.length - 1) && c === '') return false;
        return true;
      });
  }

  // Try splitting by 2 or more spaces (space-aligned columns)
  const multiSpace = line.split(/\s{2,}/).map((c) => c.trim());
  if (multiSpace.length >= 3) {
    return multiSpace;
  }

  return [];
}

/**
 * Matches a header cell against known column keywords.
 */
export function matchHeaderColumn(header: string): string | null {
  const h = header.trim();
  if (!h || h.length > 40) return null;
  // If cell contains digits, it's not a table header name (e.g. "26 attended out of 28")
  if (/\d/.test(h)) return null;

  for (const regex of HEADER_KEYWORDS.ignore) {
    if (regex.test(h)) return 'ignore';
  }
  for (const regex of HEADER_KEYWORDS.percent) {
    if (regex.test(h)) return 'percent';
  }
  for (const regex of HEADER_KEYWORDS.conducted) {
    if (regex.test(h)) return 'conducted';
  }
  for (const regex of HEADER_KEYWORDS.attended) {
    if (regex.test(h)) return 'attended';
  }
  for (const regex of HEADER_KEYWORDS.absent) {
    if (regex.test(h)) return 'absent';
  }
  for (const regex of HEADER_KEYWORDS.component) {
    if (regex.test(h)) return 'component';
  }
  for (const regex of HEADER_KEYWORDS.code) {
    if (regex.test(h)) return 'code';
  }
  for (const regex of HEADER_KEYWORDS.name) {
    if (regex.test(h)) return 'name';
  }
  return null;
}

/**
 * Detects whether a series of lines forms a valid tabular structure.
 */
export function detectTableStructure(lines: string[]): {
  isTable: boolean;
  headerRowIndex: number;
  mapping: ColumnMapping;
} {
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitRow(lines[i]);
    if (cells.length < 3) continue;

    const mapping: ColumnMapping = { ignoreCols: new Set<number>() };
    let matchCount = 0;

    cells.forEach((cell, idx) => {
      const match = matchHeaderColumn(cell);
      if (match === 'code') { mapping.codeCol = idx; matchCount++; }
      else if (match === 'name') { mapping.nameCol = idx; matchCount++; }
      else if (match === 'component') { mapping.componentCol = idx; matchCount++; }
      else if (match === 'conducted') { mapping.conductedCol = idx; matchCount++; }
      else if (match === 'attended') { mapping.attendedCol = idx; matchCount++; }
      else if (match === 'absent') { mapping.absentCol = idx; matchCount++; }
      else if (match === 'percent') { mapping.percentCol = idx; matchCount++; }
      else if (match === 'ignore') { mapping.ignoreCols.add(idx); }
    });

    // Check if at least 2 critical columns matched (and at least one attendance count/percent column)
    if (
      matchCount >= 2 &&
      (mapping.conductedCol !== undefined || mapping.attendedCol !== undefined || mapping.percentCol !== undefined)
    ) {
      // Validate that at least one subsequent line actually contains numerical counts
      let hasDataRow = false;
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const nextCells = splitRow(lines[j]);
        if (nextCells.length >= 2) {
          const condVal = mapping.conductedCol !== undefined ? nextCells[mapping.conductedCol] : undefined;
          const attVal = mapping.attendedCol !== undefined ? nextCells[mapping.attendedCol] : undefined;
          if ((condVal && /\d/.test(condVal)) || (attVal && /\d/.test(attVal))) {
            hasDataRow = true;
            break;
          }
        }
      }

      if (hasDataRow) {
        return { isTable: true, headerRowIndex: i, mapping };
      }
    }
  }

  return {
    isTable: false,
    headerRowIndex: -1,
    mapping: { ignoreCols: new Set() },
  };
}

/**
 * Parses table rows into SubjectRecord objects.
 * - Supports repeated subjects across separate L, T, P, and S rows.
 * - Merges rows only when the subject AND component type match (summing counts).
 * - Ignores metadata headers and columns.
 */
export function parseTableRows(
  lines: string[],
  headerRowIndex: number,
  mapping: ColumnMapping,
  weights: Record<ComponentType, number>
): { subjects: SubjectRecord[]; consumedLineIndices: Set<number> } {
  const consumedLineIndices = new Set<number>();
  consumedLineIndices.add(headerRowIndex);

  const subjectMap = new Map<string, SubjectRecord>();

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      consumedLineIndices.add(i);
      continue;
    }

    const cells = splitRow(line);
    if (cells.length < 2) continue; // Not a table row

    const parseCount = (col?: number): number | null => {
      if (col === undefined || col >= cells.length) return null;
      const raw = cells[col].replace(/[^\d.]/g, '').trim();
      const num = parseInt(raw, 10);
      return isNaN(num) ? null : num;
    };

    let conducted = parseCount(mapping.conductedCol);
    let attended = parseCount(mapping.attendedCol);
    const absent = parseCount(mapping.absentCol);
    let percent =
      mapping.percentCol !== undefined && mapping.percentCol < cells.length
        ? parseFloat(cells[mapping.percentCol].replace(/[^\d.]/g, ''))
        : null;
    if (isNaN(percent as number)) percent = null;

    // Check if this row actually contains counts or percentage
    if (conducted === null && attended === null && absent === null && percent === null) {
      continue;
    }

    const code = mapping.codeCol !== undefined ? cells[mapping.codeCol]?.trim() : undefined;
    let name = mapping.nameCol !== undefined ? cells[mapping.nameCol]?.trim() : undefined;
    const componentStr = mapping.componentCol !== undefined ? cells[mapping.componentCol]?.trim() : '';

    if (conducted !== null && absent !== null && attended === null) {
      attended = Math.max(0, conducted - absent);
    }
    const computedAbsent =
      absent !== null
        ? absent
        : conducted !== null && attended !== null && conducted >= attended
        ? conducted - attended
        : null;

    if (!name && code) {
      name = code;
    }

    // If name column wasn't explicitly found, scan cells for a valid subject name (avoiding numbers and metadata)
    if (!name) {
      for (let c = 0; c < cells.length; c++) {
        if (
          !mapping.ignoreCols.has(c) &&
          c !== mapping.conductedCol &&
          c !== mapping.attendedCol &&
          c !== mapping.absentCol &&
          c !== mapping.percentCol &&
          c !== mapping.componentCol
        ) {
          const val = cells[c]?.trim();
          if (val && isValidSubjectName(val)) {
            name = val;
            break;
          }
        }
      }
    }

    if (!name) continue;

    let compType: ComponentType = 'lecture';
    let compName = 'Lecture';
    if (componentStr) {
      const detected = detectComponentType(componentStr);
      if (detected) {
        compType = detected.type;
        compName = detected.name;
      } else {
        compName = componentStr;
      }
    }

    const weight = weights[compType] ?? 1.0;
    const subjectKey = (code ? code.toUpperCase() + '::' : '') + name.toLowerCase();

    let subject = subjectMap.get(subjectKey);
    if (!subject) {
      subject = {
        id: `subj-${subjectMap.size + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name,
        code: code && COURSE_CODE_REGEX.test(code) ? code : undefined,
        components: [],
        rawTextSnippet: line,
      };
      subjectMap.set(subjectKey, subject);
    }

    // Support repeated subjects across separate L, T, P, and S rows.
    // Merge rows only when the subject AND component type match (summing counts).
    const existingComp = subject.components.find((c) => c.type === compType);
    if (existingComp) {
      if (attended !== null) {
        existingComp.attended = (existingComp.attended ?? 0) + attended;
      }
      if (conducted !== null) {
        existingComp.conducted = (existingComp.conducted ?? 0) + conducted;
      }
      if (computedAbsent !== null) {
        existingComp.absent = (existingComp.absent ?? 0) + computedAbsent;
      }
    } else {
      const componentRecord: ComponentRecord = {
        id: `comp-${subject.components.length + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: compType,
        name: compName || formatComponentName(compType),
        attended,
        conducted,
        absent: computedAbsent,
        isAbsentDerived: absent === null,
        percentage: percent,
        weight,
        confidence: 'high',
        source: 'table',
        sourceSnippet: line,
      };
      subject.components.push(componentRecord);
    }

    consumedLineIndices.add(i);
  }

  return {
    subjects: Array.from(subjectMap.values()),
    consumedLineIndices,
  };
}

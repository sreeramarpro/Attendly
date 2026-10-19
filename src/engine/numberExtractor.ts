export interface ExtractedCounts {
  attended: number | null;
  conducted: number | null;
  absent: number | null;
  percentage?: number | null;
  confidence: 'high' | 'medium' | 'low' | 'inferred';
  isAbsentDerived?: boolean;
  rawSnippet: string;
  isAmbiguous?: boolean;
}

/**
 * Attempts to extract attended, conducted, absent, or percentage counts from a text phrase.
 */
export function extractAttendanceCounts(text: string): ExtractedCounts | null {
  // Strip section markers (e.g. "section 4", "sec 2") before count extraction so they aren't parsed as counts
  const clean = text.replace(/\b(?:section|sec)\s+\w+\b/gi, '').trim();
  if (!clean) return null;

  // Pattern 0: Ambiguous list of numbers without labels (e.g. "the numbers are 20, 18 and 2")
  const ambiguousNumbersMatch = clean.match(/(?:(?:the\s+)?numbers?\s+are|values?\s+are)\s+(\d+)[,\s]+(\d+)\s+(?:and|,)\s+(\d+)/i);
  if (ambiguousNumbersMatch) {
    return {
      attended: null,
      conducted: null,
      absent: null,
      confidence: 'low',
      isAmbiguous: true,
      rawSnippet: clean,
    };
  }

  // Pattern 1: "All N [lectures/classes] attended"
  const allAttendedMatch = clean.match(/\ball\s+(\d+)\s*(?:lectures?|classes?|sessions?|practicals?|tutorials?|labs?)?\s*attended\b/i);
  if (allAttendedMatch) {
    const total = parseInt(allAttendedMatch[1], 10);
    return {
      attended: total,
      conducted: total,
      absent: 0,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Pattern 2: "bunked / missed / skipped X of / out of Y (classes/lectures)"
  const missedOutOfMatch = clean.match(/(?:bunked|missed|skipped|absent\s+for|absent\s+in|absnt\s+for|absnt\s+in)\s+(\d+)\s*(?:classes|lectures|lectuers|practicals|practcals|tutorials|labs)?\s*(?:out\s+of|of|from)\s*(?:the\s+)?(\d+)/i);
  if (missedOutOfMatch) {
    const absent = parseInt(missedOutOfMatch[1], 10);
    const conducted = parseInt(missedOutOfMatch[2], 10);
    return {
      attended: Math.max(0, conducted - absent),
      conducted,
      absent,
      isAbsentDerived: true,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Pattern 3: "attended X and missed Y" or "X attended and Y missed/absent"
  const attendedAndMissedMatch =
    clean.match(/(?:attended|attnded|present)\s+(\d+)\s+(?:and|,|n)\s+(?:missed|absent|absnt|skipped)\s+(\d+)/i) ||
    clean.match(/(\d+)\s+(?:attended|attnded|present)\s+(?:and|,|n)\s+(\d+)\s+(?:missed|absent|absnt|skipped)/i);
  if (attendedAndMissedMatch) {
    const attended = parseInt(attendedAndMissedMatch[1], 10);
    const absent = parseInt(attendedAndMissedMatch[2], 10);
    return {
      attended,
      conducted: attended + absent,
      absent,
      isAbsentDerived: true,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Pattern 4: "out of Y [classes], (I went to / attended) X"
  const outOfYwentToXMatch = clean.match(/out\s+of\s+(\d+)(?:[^\d,;]+)?(?:I\s+(?:went\s+to|attended|attnded)|attended|attnded|present)\s+(\d+)/i);
  if (outOfYwentToXMatch) {
    const conducted = parseInt(outOfYwentToXMatch[1], 10);
    const attended = parseInt(outOfYwentToXMatch[2], 10);
    return {
      attended,
      conducted,
      absent: conducted >= attended ? conducted - attended : null,
      isAbsentDerived: true,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Pattern 5: "X [attended] out of / from / of Y" (e.g. "26 attended out of 28", "28 attended out of 26", "went to 31 classes out of 36 lectures", "26 of 31", "16 from 24", "0 attended out of 0")
  const outOfMatch = clean.match(/(?:(?:went\s+to|attended|attnded|present)\s+)?(\d+)\s*(?:classes|lectures|lectuers|practicals|practcals|tutorials|labs)?\s*(?:attended|attnded|present)?\s*(?:out\s+of|from|of)\s*(\d+)/i);
  if (outOfMatch) {
    const attended = parseInt(outOfMatch[1], 10);
    const conducted = parseInt(outOfMatch[2], 10);
    return {
      attended,
      conducted,
      absent: conducted >= attended ? conducted - attended : null,
      isAbsentDerived: true,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Pattern 6: Ratio "X/Y" or "X / Y" (e.g. "26/28", "18/20")
  const slashMatch = clean.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (slashMatch) {
    const attended = parseInt(slashMatch[1], 10);
    const conducted = parseInt(slashMatch[2], 10);
    return {
      attended,
      conducted,
      absent: conducted >= attended ? conducted - attended : null,
      isAbsentDerived: true,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Pattern 7: Explicitly labeled counts (supports typos: attnded, conductd, absnt, and words in-between like "32 lectuers conductd")
  const labeledAttended =
    clean.match(/\b(?:attended|attnded|present)\s*[:=]?\s*(\d+)\b/i) ||
    clean.match(/\b(\d+)\s+(?:attended|attnded|present)\b/i);

  const labeledConducted =
    clean.match(/\b(?:conducted|conductd|held|taken|total)\s*[:=]?\s*(\d+)\b/i) ||
    clean.match(/\b(\d+)\s*(?:lectures?|lectuers?|practicals?|practcals?|tutorials?|classes?|sessions?|labs?)?\s*(?:conducted|conductd|held|taken|total)\b/i);

  const labeledAbsent =
    clean.match(/\b(?:absent|absnt|missed|skipped)\s*[:=]?\s*(\d+)\b/i) ||
    clean.match(/\b(\d+)\s+(?:absent|absnt|missed|skipped)\b/i);

  if (labeledAttended && labeledConducted) {
    const attended = parseInt(labeledAttended[1], 10);
    const conducted = parseInt(labeledConducted[1], 10);
    const absent = labeledAbsent
      ? parseInt(labeledAbsent[1], 10)
      : conducted >= attended
      ? conducted - attended
      : null;
    return {
      attended,
      conducted,
      absent,
      isAbsentDerived: !labeledAbsent,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Labeled conducted & absent: "conducted 28, absent 2" or "32 lectuers conductd, 5 absnt"
  if (labeledConducted && labeledAbsent && !labeledAttended) {
    const conducted = parseInt(labeledConducted[1], 10);
    const absent = parseInt(labeledAbsent[1], 10);
    return {
      attended: Math.max(0, conducted - absent),
      conducted,
      absent,
      isAbsentDerived: false,
      confidence: 'high',
      rawSnippet: clean,
    };
  }

  // Pattern 8: Percentage only: "92 percent" or "92.5%" or "attendance is 85%"
  const percentMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:%|percent(?:age)?)\b/i);
  if (percentMatch) {
    const percentage = parseFloat(percentMatch[1]);
    return {
      attended: null,
      conducted: null,
      absent: null,
      percentage,
      confidence: 'medium',
      rawSnippet: clean,
    };
  }

  // Pattern 9: Shorthand two numbers after component letter: e.g. "L 26 28" or "P 16 24"
  const componentTwoNumbers = clean.match(/\b([LTPStp])\s+(\d+)\s+(\d+)\b/);
  if (componentTwoNumbers) {
    const attended = parseInt(componentTwoNumbers[2], 10);
    const conducted = parseInt(componentTwoNumbers[3], 10);
    return {
      attended,
      conducted,
      absent: conducted >= attended ? conducted - attended : null,
      confidence: 'medium',
      rawSnippet: clean,
    };
  }

  // Pattern 10: Bare two numbers (e.g. "ASE 26 28") without explicit labels or slashes.
  const bareNumbers = clean.match(/\b(\d+)\s+(\d+)\b/);
  if (bareNumbers) {
    const n1 = parseInt(bareNumbers[1], 10);
    const n2 = parseInt(bareNumbers[2], 10);
    return {
      attended: n1,
      conducted: n2,
      absent: n2 >= n1 ? n2 - n1 : null,
      confidence: 'low',
      isAmbiguous: true,
      rawSnippet: clean,
    };
  }

  return null;
}

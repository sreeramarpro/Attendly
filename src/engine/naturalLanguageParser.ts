import type {
  ComponentRecord,
  ComponentType,
  ParsingWarning,
  SubjectRecord,
} from '../types/attendance.js';
import { detectComponentType } from './componentDetector.js';
import { extractAttendanceCounts } from './numberExtractor.js';
import {
  COURSE_CODE_REGEX,
  cleanSubjectName,
  extractCourseCode,
  isValidSubjectName,
} from './subjectDetector.js';

interface RawSubjectSegment {
  name: string;
  code?: string;
  segmentText: string;
  isPartial?: boolean;
}

/**
 * Extracts explicit component weights defined in natural language text.
 * e.g. "Lecture weight is 1 and practical weight is 0.5"
 */
export function extractWeightsFromText(
  text: string,
  baseWeights: Record<ComponentType, number>
): Record<ComponentType, number> {
  const updated = { ...baseWeights };
  const matches = text.matchAll(
    /\b(lecture|lectures|lectuer|lectuers|lectre|lec|lecs|theory|practical|practicals|practcal|practcals|practicle|practicles|prac|pracs|lab|labs|tutorial|tutorials|tut|tuts|skill|skills|skl|skls)\s+weight\s+is\s+([\d.]+)/gi
  );
  for (const m of matches) {
    const rawType = m[1].toLowerCase();
    const val = parseFloat(m[2]);
    if (!isNaN(val)) {
      if (/lecture|lectuer|lectre|lec|theory/i.test(rawType)) updated.lecture = val;
      if (/practical|practcal|practicle|prac|lab/i.test(rawType)) updated.practical = val;
      if (/tutorial|tut/i.test(rawType)) updated.tutorial = val;
      if (/skill|skl/i.test(rawType)) updated.skill = val;
    }
  }
  return updated;
}

/**
 * Strips instructional meta-sentences from a subject's snippet text.
 */
function stripInstructionSentences(text: string): string {
  return text
    .replace(/\b(?:do\s+not\s+average|don't\s+average|average\s+the\s+two)[^.]*\.?/gi, '')
    .replace(/\b(?:lecture|lectuer|lectre|lec|practical|practcal|practicle|prac|tutorial|tut|skill|skl|theory|lab)?\s*weight\s+is\s+[\d.]+(?:\s+and\s+(?:practical|practcal|practicle|prac|tutorial|tut|skill|skl|lecture|lec)?\s*weight\s+is\s+[\d.]+)?\.?/gi, '')
    .replace(/\bcalculate\s+(?:the\s+|my\s+|overall\s+)?attendance\.?/gi, '')
    .replace(/\bwork\s+out\s+(?:the\s+)?attendance\.?/gi, '')
    .replace(/\bwhat\s+(?:is|will\s+be)\s+my\s+attendance\??/gi, '')
    .trim();
}

/**
 * Tests whether a sentence/chunk is purely an instruction or command.
 */
function isInstructionChunk(chunk: string): boolean {
  const clean = chunk.trim();
  if (/^(?:please\s+)?(?:calculate|compute|work\s+out|find|show|tell\s+me)\s+(?:the\s+|my\s+|overall\s+)?attendance/i.test(clean)) {
    return true;
  }
  if (/^(?:do\s+not\s+average|don't\s+average|average\s+the\s+two)/i.test(clean)) {
    return true;
  }
  if (/^(?:lecture|lectuer|lectre|lec|practical|practcal|prac|tutorial|tut|skill|skl|theory|lab)?\s*weight\s+is\s+[\d.]+/i.test(clean)) {
    return true;
  }
  if (/^(?:what|how|why|when|where)\s+(?:is|will\s+be)\s+my\s+attendance\??$/i.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Splits natural language or shorthand text into individual subject segments in document order.
 */
export function segmentTextBySubjects(text: string): RawSubjectSegment[] {
  const segments: RawSubjectSegment[] = [];

  let cleaned = text.replace(/^my\s+attendance\s+(?:is|for\s+this\s+semester\s+is)\s*[:=]?\s*/i, '').trim();
  if (!cleaned) return segments;

  // Strategy 1: Check for colon-separated or dash-separated subjects (e.g. "Mathematics: 24/30. Physics: 19/20." or "Deep Learning - attended 27/32" or "AI: L 18/20, T 9/10, P 8/12, S 16/20.")
  const colonOrDashRegex = /(?:^|\n|(?<=[.!?])\s+|;\s*)([A-Za-z0-9][A-Za-z0-9\s-]{0,60}?)\s*(?::|(?<=\s)[-–—](?=\s))\s*/g;
  const separatorMatches: { name: string; matchIndex: number; contentStartIndex: number }[] = [];
  let cm: RegExpExecArray | null;

  while ((cm = colonOrDashRegex.exec(cleaned)) !== null) {
    const rawCandidate = cm[1].trim();
    const candidateName = cleanSubjectName(rawCandidate);
    if (isValidSubjectName(candidateName)) {
      separatorMatches.push({
        name: candidateName,
        matchIndex: cm.index,
        contentStartIndex: cm.index + cm[0].length,
      });
    }
  }

  if (separatorMatches.length > 0) {
    for (let i = 0; i < separatorMatches.length; i++) {
      const current = separatorMatches[i];
      const next = separatorMatches[i + 1];
      const rawContent = next
        ? cleaned.substring(current.contentStartIndex, next.matchIndex)
        : cleaned.substring(current.contentStartIndex);

      const strippedContent = stripInstructionSentences(rawContent);
      const code = extractCourseCode(current.name);
      const cleanedName = cleanSubjectName(current.name);

      segments.push({
        name: cleanedName,
        code: code ?? undefined,
        segmentText: strippedContent,
        isPartial: !strippedContent.trim(),
      });
    }
    return segments;
  }

  // Strategy 2: Sentence / clause-based segmentation for non-colon text
  const rawChunks = cleaned
    .split(/(?:\r?\n)+|(?<=[0-9a-zA-Z])\s*\.\s*(?=[A-Za-z])|(?<=[A-Za-z0-9])\s*;\s*/g)
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => !isInstructionChunk(c));

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];

    // 1. Look for "I don't know my ... attendance for <Subject> yet"
    const unknownMatch = chunk.match(/I\s+don't\s+know\s+my\s+([a-zA-Z\s]+)\s+attendance\s+for\s+([a-zA-Z0-9\s-]+?)(?:\s+yet|\.|$)/i);
    if (unknownMatch && isValidSubjectName(unknownMatch[2])) {
      segments.push({
        name: unknownMatch[2].trim(),
        segmentText: `unknown ${unknownMatch[1].trim()}`,
        isPartial: true,
      });
      continue;
    }

    // 2. Look for "I have <Subject>, but I haven't entered..."
    const haveMatch = chunk.match(/I\s+have\s+([a-zA-Z0-9\s-]+?),\s*but\s+I\s+haven't\s+entered/i);
    if (haveMatch && isValidSubjectName(haveMatch[1])) {
      segments.push({
        name: haveMatch[1].trim(),
        segmentText: '',
        isPartial: true,
      });
      continue;
    }

    // 3. Look for "<Subject> has ..." (e.g. "Cloud Computing has L=30/32 and P=10/20")
    const hasMatch = chunk.match(/^([a-zA-Z0-9\s-]+?)\s+has\s+([\s\S]*)/i);
    if (hasMatch && isValidSubjectName(hasMatch[1]) && /\d+/.test(hasMatch[2])) {
      segments.push({
        name: hasMatch[1].trim(),
        segmentText: hasMatch[2].trim(),
      });
      continue;
    }

    // 4. Look for "Add <Subject>. The lecture attendance is..."
    const addMatch = chunk.match(/^Add\s+([a-zA-Z0-9\s-]+?)(?:\.|$)\s*([\s\S]*)/i);
    if (addMatch && isValidSubjectName(addMatch[1])) {
      segments.push({
        name: addMatch[1].trim(),
        segmentText: addMatch[2].trim(),
      });
      continue;
    }

    // 5. Look for "For <Subject>, ..." or "For <Subject> ..."
    const forMatch = chunk.match(/\bfor\s+([a-zA-Z0-9\s-]+?)(?:,|\.|\s+theory|\s+lecture|\s+I\s+attended|\s+there\s+were|\s+is\s+my\s+subject)([\s\S]*)/i);
    if (forMatch && isValidSubjectName(forMatch[1])) {
      segments.push({
        name: forMatch[1].trim(),
        segmentText: forMatch[2].trim() || chunk,
      });
      continue;
    }

    // 6. Look for clause ending with "... in/for <Subject> [lecture/theory/etc.]"
    const endSubjectMatch = chunk.match(/^([\s\S]+?)\s+(?:in|for)\s+([a-zA-Z0-9\s-]+?)(?:\s+(?:lecture|theory|practical|lab|tutorial|skill|classes|practicals|lectures))?$/i);
    if (endSubjectMatch && isValidSubjectName(endSubjectMatch[2])) {
      const candidateCounts = extractAttendanceCounts(endSubjectMatch[1]);
      if (candidateCounts) {
        segments.push({
          name: endSubjectMatch[2].trim(),
          segmentText: chunk,
        });
        continue;
      }
    }

    // 7. Look for "In CS301 section 4, I attended 26 out of 28 lectures."
    const inCourseMatch = chunk.match(/^in\s+([A-Za-z0-9\s-]+?)(?:,\s*|\s+(?:section|sec)\s+\w+,\s*|\s+(?:section|sec)\s+\w+\s+)([\s\S]+)/i);
    if (inCourseMatch && isValidSubjectName(inCourseMatch[1])) {
      const subjName = inCourseMatch[1].replace(/\s+(?:section|sec)\s+\w+/i, '').trim();
      const codeMatch = subjName.match(COURSE_CODE_REGEX);
      segments.push({
        name: subjName,
        code: codeMatch ? codeMatch[1] : undefined,
        segmentText: inCourseMatch[2].trim(),
      });
      continue;
    }

    // 8. Check if current chunk is a standalone Subject Name followed by an attendance clause
    // e.g. Chunk 0: "Cloud Computing", Chunk 1: "I have attended 30 of 32 lectures and 10 of 20 practicals"
    if (isValidSubjectName(chunk) && !/\d+/.test(chunk)) {
      const nextChunk = rawChunks[i + 1];
      if (nextChunk && /\d+/.test(nextChunk) && !isValidSubjectName(nextChunk.split(/\s+/)[0])) {
        segments.push({
          name: chunk.trim(),
          segmentText: nextChunk.trim(),
        });
        i++; // skip nextChunk since it was consumed
        continue;
      }
    }

    // 8. Group comma parts: if a comma is followed by a component like ", lab 16/22", keep in same clause
    const subClauses: string[] = [];
    const commaParts = chunk.split(/,\s*/);
    let currentClause = '';

    for (let p = 0; p < commaParts.length; p++) {
      const part = commaParts[p];
      const startsWithComponent = /^(?:L|P|T|S|lecture|lectures|lectuer|lectuers|lectre|lec|lecs|theory|th|practical|practicals|practcal|practcals|practicle|practicles|prac|pracs|lab|labs|tutorial|tutorials|tut|tuts|skill|skills|skl|skls)\b/i.test(part);

      if (startsWithComponent && currentClause) {
        currentClause += ', ' + part;
      } else {
        if (currentClause) {
          subClauses.push(currentClause);
        }
        currentClause = part;
      }
    }
    if (currentClause) {
      subClauses.push(currentClause);
    }

    for (const clause of subClauses) {
      const trimmedClause = clause.trim();
      if (!trimmedClause || isInstructionChunk(trimmedClause)) continue;

      // "<Subject> is my subject. ..."
      const isMySubjectMatch = trimmedClause.match(/^([a-zA-Z0-9\s-]+?)\s+is\s+my\s+subject\.?\s*([\s\S]*)/i);
      if (isMySubjectMatch && isValidSubjectName(isMySubjectMatch[1])) {
        segments.push({
          name: isMySubjectMatch[1].trim(),
          segmentText: isMySubjectMatch[2].trim(),
        });
        continue;
      }

      // Course code at start
      const courseCodeMatch = trimmedClause.match(COURSE_CODE_REGEX);
      if (courseCodeMatch && trimmedClause.indexOf(courseCodeMatch[0]) === 0) {
        const code = courseCodeMatch[1];
        const afterCode = trimmedClause.substring(code.length).trim();
        const compMatch = afterCode.match(/\b(lecture|lectures|lectuer|lectuers|lectre|lec|lecs|theory|th|practical|practicals|practcal|prac|pracs|lab|labs|tutorial|tutorials|tut|tuts|skill|skills|skl|skls|L|P|T|S)\b/i);
        let subjName = code;
        let textRest = afterCode;
        if (compMatch && compMatch.index && compMatch.index > 0) {
          const potentialName = afterCode.substring(0, compMatch.index).trim();
          if (isValidSubjectName(potentialName)) {
            subjName = potentialName;
            textRest = afterCode.substring(compMatch.index).trim();
          }
        }
        segments.push({
          name: subjName,
          code: code,
          segmentText: textRest,
        });
        continue;
      }

      // Look for where subject ends: before dash, status word, component word, ratio, numbers, or "I went to"
      const words = trimmedClause.split(/\s+/);
      let subjectEndIndex = -1;

      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        const lower = word.toLowerCase();

        // Dash separator between subject and attendance: e.g. "Deep Learning - attended 27/32"
        if ((word === '-' || word === '–' || word === '—') && w >= 1) {
          subjectEndIndex = w;
          break;
        }

        // Attendance status words: "attended", "conducted", "absent", etc.
        if (
          (lower === 'attended' || lower === 'attnded' || lower === 'present' ||
           lower === 'conducted' || lower === 'conductd' || lower === 'held' || lower === 'taken' ||
           lower === 'absent' || lower === 'absnt' || lower === 'missed' || lower === 'skipped') &&
          w >= 1
        ) {
          subjectEndIndex = (words[w - 1] === '-' || words[w - 1] === '–' || words[w - 1] === '—' || words[w - 1] === ':')
            ? w - 1
            : w;
          break;
        }

        if ((lower === 'l' || lower === 'p' || lower === 't' || lower === 's') && /^\d+$/.test(words[w + 1] || '')) {
          subjectEndIndex = w;
          break;
        }

        if (
          lower === 'lecture' || lower === 'lectures' || lower === 'lectuer' || lower === 'lectuers' || lower === 'lectre' || lower === 'lec' || lower === 'lecs' ||
          lower === 'theory' || lower === 'th' ||
          lower === 'practical' || lower === 'practicals' || lower === 'practcal' || lower === 'practcals' || lower === 'practicle' || lower === 'practicles' || lower === 'prac' || lower === 'pracs' || lower === 'lab' || lower === 'labs' ||
          lower === 'tutorial' || lower === 'tutorials' || lower === 'tut' || lower === 'tuts' ||
          lower === 'skill' || lower === 'skills' || lower === 'skl' || lower === 'skls'
        ) {
          subjectEndIndex = w;
          break;
        }

        if (/^\d+\/\d+$/.test(word)) {
          subjectEndIndex = w;
          break;
        }

        if (/^\d+$/.test(word)) {
          if (w >= 1) {
            subjectEndIndex = w;
            break;
          }
        }

        if (word === 'I' && words[w + 1]?.toLowerCase() === 'went') {
          subjectEndIndex = w;
          break;
        }
      }

      if (subjectEndIndex > 0) {
        const rawSubj = cleanSubjectName(words.slice(0, subjectEndIndex).join(' '));
        const remainder = words.slice(subjectEndIndex).join(' ').replace(/^[\-–—:\s]+/, '').trim();

        if (isValidSubjectName(rawSubj)) {
          segments.push({
            name: rawSubj,
            segmentText: remainder,
          });
          continue;
        }
      }

      // Fallback: attendance counts without subject name (e.g. "I attended 27 out of 32 classes")
      const fallbackCounts = extractAttendanceCounts(trimmedClause);
      if (
        fallbackCounts &&
        fallbackCounts.attended !== null &&
        fallbackCounts.conducted !== null &&
        !fallbackCounts.isAmbiguous
      ) {
        segments.push({
          name: 'General Attendance',
          segmentText: trimmedClause,
        });
        continue;
      }

      // Bare numbers check: "ASE 26 28"
      const bareMatch = trimmedClause.match(/^(.+?)\s+(\d+)\s+(\d+)$/);
      if (bareMatch && isValidSubjectName(bareMatch[1])) {
        segments.push({
          name: cleanSubjectName(bareMatch[1]),
          segmentText: `${bareMatch[2]} ${bareMatch[3]}`,
        });
      } else if (isValidSubjectName(trimmedClause) && (COURSE_CODE_REGEX.test(trimmedClause) || /^(?:subject|course)\s*:\s*/i.test(trimmedClause))) {
        segments.push({
          name: cleanSubjectName(trimmedClause),
          segmentText: '',
          isPartial: true,
        });
      }
    }
  }

  return segments;
}

/**
 * Parses attendance components and counts within a subject's segment text.
 */
export function parseSubjectComponents(
  segmentText: string,
  subjectName: string,
  weights: Record<ComponentType, number>
): { components: ComponentRecord[]; warnings: ParsingWarning[] } {
  const components: ComponentRecord[] = [];
  const warnings: ParsingWarning[] = [];

  const textToScan = segmentText.trim();
  if (!textToScan) {
    return { components, warnings };
  }

  // Count distinct component tokens
  const componentTokensRegex = /\b(L|lecture|lectures|lectuer|lectuers|lectre|lec|lecs|theory|th|P|practical|practicals|practcal|practcals|practicle|practicles|prac|pracs|lab|labs|T|tutorial|tutorials|tut|tuts|S|skill|skills|skl|skls)\b/gi;
  const tokenMatches: { index: number; text: string }[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = componentTokensRegex.exec(textToScan)) !== null) {
    tokenMatches.push({ index: tm.index, text: tm[1] });
  }

  // If there's only 1 component token or 0, or if numbers precede the token (like "I attended 26 out of 28 lectures")
  if (tokenMatches.length <= 1) {
    const counts = extractAttendanceCounts(textToScan);
    const compDetection = detectComponentType(tokenMatches[0]?.text || textToScan);
    const compType: ComponentType = compDetection ? compDetection.type : 'lecture';
    const compName = compDetection ? compDetection.name : 'Lecture';

    if (counts) {
      const compRecord: ComponentRecord = {
        id: `comp-1-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: compType,
        name: compName,
        attended: counts.attended,
        conducted: counts.conducted,
        absent: counts.absent,
        percentage: counts.percentage,
        weight: weights[compType] ?? 1.0,
        confidence: counts.confidence,
        source: 'sentence',
        sourceSnippet: textToScan,
        isAbsentDerived: counts.isAbsentDerived,
      };

      if (counts.isAmbiguous) {
        warnings.push({
          id: `warn-ambig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          subjectName,
          componentId: compRecord.id,
          type: 'ambiguous_values',
          message: `The values in "${textToScan}" for ${subjectName} are ambiguous. Which of these numbers is attended, conducted, and absent?`,
          snippet: textToScan,
          suggestedAction: 'Which of these numbers is attended, conducted, and absent?',
          resolvable: true,
        });
      }

      components.push(compRecord);
      return { components, warnings };
    }
  }

  // If multiple component tokens exist, split into sub-blocks accurately preserving counts
  const subBlocks: { compText: string; chunk: string }[] = [];
  let lastEnd = 0;

  for (let i = 0; i < tokenMatches.length; i++) {
    const current = tokenMatches[i];
    const next = tokenMatches[i + 1];

    const start = lastEnd;
    let end = textToScan.length;
    let nextStart = textToScan.length;

    if (next) {
      const betweenStart = current.index + current.text.length;
      const betweenText = textToScan.substring(betweenStart, next.index);

      // Check for explicit delimiter: comma, semicolon, "and", "&", "+"
      const delimMatch = betweenText.match(/\s*(?:,|;|and|&|\+)\s*/i);
      if (delimMatch && delimMatch.index !== undefined) {
        end = betweenStart + delimMatch.index;
        nextStart = betweenStart + delimMatch.index + delimMatch[0].length;
      } else {
        // No explicit delimiter
        // Check if current chunk already has numbers before the token (e.g. "27/32 lec")
        const currentPrefix = textToScan.substring(start, current.index);
        const hasPrefixNumbers = /\d+/.test(currentPrefix);

        if (hasPrefixNumbers) {
          // Numbers in betweenText belong to next token
          const numMatch = betweenText.match(/\b\d+/);
          if (numMatch && numMatch.index !== undefined) {
            end = betweenStart + numMatch.index;
            nextStart = end;
          } else {
            end = next.index;
            nextStart = next.index;
          }
        } else {
          // Numbers in betweenText belong to current token (e.g. "L 18/20 P 16/22")
          end = next.index;
          nextStart = next.index;
        }
      }
    }

    const chunk = textToScan.substring(start, end).trim();
    subBlocks.push({ compText: current.text, chunk });
    lastEnd = nextStart;
  }

  for (const block of subBlocks) {
    const compDetection = detectComponentType(block.compText);
    const compType: ComponentType = compDetection ? compDetection.type : 'general';
    const compName = compDetection ? compDetection.name : block.compText;

    const counts = extractAttendanceCounts(block.chunk);
    if (counts) {
      const compRecord: ComponentRecord = {
        id: `comp-${components.length + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: compType,
        name: compName,
        attended: counts.attended,
        conducted: counts.conducted,
        absent: counts.absent,
        percentage: counts.percentage,
        weight: weights[compType] ?? 1.0,
        confidence: counts.confidence,
        source: 'sentence',
        sourceSnippet: block.chunk,
        isAbsentDerived: counts.isAbsentDerived,
      };

      if (counts.isAmbiguous) {
        warnings.push({
          id: `warn-ambig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          subjectName,
          componentId: compRecord.id,
          type: 'ambiguous_values',
          message: `The values in "${block.chunk}" for ${subjectName} are ambiguous. Which of these numbers is attended, conducted, and absent?`,
          snippet: block.chunk,
          suggestedAction: 'Which of these numbers is attended, conducted, and absent?',
          resolvable: true,
        });
      }

      components.push(compRecord);
    } else {
      components.push({
        id: `comp-${components.length + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: compType,
        name: compName,
        attended: null,
        conducted: null,
        absent: null,
        weight: weights[compType] ?? 1.0,
        confidence: 'low',
        sourceSnippet: block.chunk,
      });

      warnings.push({
        id: `warn-missing-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        subjectName,
        type: 'missing_counts',
        message: `${compName} attendance for "${subjectName}" is missing counts.`,
        snippet: block.chunk,
        suggestedAction: 'Add the attended and conducted counts in the review panel.',
        resolvable: true,
      });
    }
  }

  return { components, warnings };
}

/**
 * Parses free-form natural language and shorthand text into SubjectRecord array with warnings.
 */
export function parseNaturalLanguageInput(
  text: string,
  weights: Record<ComponentType, number>
): { subjects: SubjectRecord[]; warnings: ParsingWarning[] } {
  // Extract custom weights from the text if present
  const effectiveWeights = extractWeightsFromText(text, weights);
  const segments = segmentTextBySubjects(text);
  const subjects: SubjectRecord[] = [];
  const allWarnings: ParsingWarning[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const { components, warnings } = parseSubjectComponents(seg.segmentText, seg.name, effectiveWeights);

    allWarnings.push(...warnings);

    const hasMissingCounts =
      components.length === 0 ||
      components.some((c) => c.attended === null || c.conducted === null);

    const subjectRecord: SubjectRecord = {
      id: `subj-${i + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: seg.name,
      code: seg.code,
      components,
      isPartial: seg.isPartial || hasMissingCounts,
      rawTextSnippet: seg.segmentText,
    };

    subjects.push(subjectRecord);
  }

  return { subjects, warnings: allWarnings };
}

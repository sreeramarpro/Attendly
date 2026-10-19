/**
 * Utilities to detect course codes and subject names from raw text.
 */

// Course code pattern: 2-5 letters directly followed by 2-5 digits, or hyphen-separated (e.g., CS101, 21CS3001, IT402A, MAT-102, 24CI3201)
// NOTE: Does not match space-separated (e.g. "ASE 26") so attendance counts are not mistaken for course codes.
export const COURSE_CODE_REGEX = /\b([0-9]{2}[A-Z]{2,4}[0-9]{2,4}[A-Z]?|[A-Z]{2,5}-?[0-9]{2,5}[A-Z]?)\b/;

// Words that frequently introduce a subject
export const SUBJECT_PREFIX_REGEX = /^(?:for\s+|add\s+|in\s+|subject\s*:\s*|course\s*:\s*|my\s+attendance\s+is\s+)/i;

// Words that cannot be subject names alone
export const RESERVED_WORDS = new Set([
  'lecture', 'lectures', 'lectuer', 'lectuers', 'lectre', 'lectres', 'lec', 'lecs', 'theory', 'theories', 'th',
  'practical', 'practicals', 'practcal', 'practcals', 'lab', 'labs', 'prac', 'pracs',
  'tutorial', 'tutorials', 'tut', 'tuts', 'skill', 'skills', 'skl', 'skls',
  'class', 'classes', 'attendance', 'attended', 'attnded',
  'present', 'conducted', 'conductd', 'held', 'taken', 'total', 'absent', 'absnt', 'missed', 'percent', 'percentage',
  'out', 'of', 'from', 'and', 'the', 'my', 'is', 'are', 'for', 'to', 'in', 'yet', 'so',
  'i', 'have', 'went', 'there', 'were', 'was', "don't", 'dont', 'know', 'yet', 'section', 'sec', 'group',
  'sem', 'semester', 'odd', 'even', 'odd sem', 'even sem', 'sem n', 'register', 'registered', 'registration',
  'tcbr', 'fr', 'date', 'action', 'status', 'year', 'academic year', 'sno', 'slno', 's.no', 'sl.no',
  'n', 'y', 'ltps', 'total conducted', 'total attended', 'total absent'
]);

/**
 * Strips punctuation and trailing status language from a subject name.
 * e.g. "Deep Learning - attended" -> "Deep Learning", "Maths:" -> "Maths"
 */
export function cleanSubjectName(name: string): string {
  let clean = name.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, '').trim();
  // Strip trailing status annotations like "- attended", ": attended", "- conducted", "attended", etc.
  clean = clean.replace(/\s*[:\-–—]?\s*\b(?:attended|attnded|present|conducted|conductd|held|taken|absent|absnt|missed|skipped)\b\s*$/i, '');
  return clean.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, '').trim();
}

/**
 * Checks if a string looks like a valid subject name.
 */
export function isValidSubjectName(name: string): boolean {
  const clean = cleanSubjectName(name);
  if (clean.length < 2 || clean.length > 80) return false;
  if (/^\d+$/.test(clean)) return false; // purely numeric
  if (RESERVED_WORDS.has(clean.toLowerCase())) return false;

  // Reject conversational opinions, target statements, or sentences
  if (/\b(?:target\s+is|my\s+target|goal\s+is|aim\s+is|hardest\s+subject|easiest\s+subject|favorite\s+subject|difficult\s+subject)\b/i.test(clean)) {
    return false;
  }
  if (/\b(?:is\s+my|are\s+my|was\s+my|were\s+my|is\s+the|is\s+a|is\s+an)\b/i.test(clean)) {
    return false;
  }
  if (/\b(?:hardest|easiest|worst|toughest|favorite|favourite)\b/i.test(clean)) {
    return false;
  }
  if (/\b(?:i\s+think|i\s+feel|i\s+hope|i\s+guess|in\s+my\s+opinion)\b/i.test(clean)) {
    return false;
  }

  // Reject sentences with conversational pronouns + verbs
  const words = clean.split(/\s+/);
  if (words.length > 4 && /\b(?:my|i|you|he|she|they|we|is|are|was|were|have|has|had)\b/i.test(clean)) {
    return false;
  }

  // Reject absence statements like "missed 5 lec and 7 prac"
  if (/^(?:i\s+)?(?:missed|bunked|skipped|absent|attended|conducted)\b/i.test(clean)) {
    return false;
  }

  // Reject questions
  if (/^(?:what|how|why|when|where|can\s+i|is\s+my|will\s+my|should\s+i)\b/i.test(clean)) {
    return false;
  }
  if (/\?$/.test(clean)) {
    return false;
  }

  // Reject calculation commands
  if (/^(?:please\s+)?(?:calculate|compute|work\s+out|find|show|tell\s+me|get|solve|display)\b/i.test(clean)) {
    return false;
  }
  if (/\b(?:calculate\s+(?:the\s+|my\s+|overall\s+)?attendance|work\s+out\s+(?:the\s+)?attendance)\b/i.test(clean)) {
    return false;
  }

  // Reject weight descriptions and calculation constraints
  if (/\b(?:weight\s+is|lecture\s+weight|practical\s+weight|tutorial\s+weight|skill\s+weight)\b/i.test(clean)) {
    return false;
  }
  if (/\b(?:do\s+not\s+average|don't\s+average|average\s+the\s+two|overall\s+attendance)\b/i.test(clean)) {
    return false;
  }

  // Reject future projection / hypothetical statements
  if (/^(?:if\s+i|suppose\s+i|there\s+are\s+\d+|how\s+many\s+classes)\b/i.test(clean)) {
    return false;
  }
  if (/\b(?:more\s+classes|consecutive\s+classes|attend\s+all\s+of\s+them|skip\s+the\s+next)\b/i.test(clean)) {
    return false;
  }

  // Reject filler / introductory phrases
  if (/^(?:the\s+)?numbers?\s+are\b/i.test(clean) || /^(?:my\s+attendance|here\s+is\s+my)\b/i.test(clean)) {
    return false;
  }

  // Reject semester / academic year / registration / section metadata
  if (/^(?:sem|semester|odd|even|odd\s+sem|even\s+sem|sem\s+[a-z0-9]|academic\s+year|year|register|registered|registration|tcbr|fr|section|sec|s-\w+|sec-\w+)\b/i.test(clean)) {
    return false;
  }
  if (/\b(?:odd\s+sem|even\s+sem|sem\s+n|sem\s+\d+|register|registered|tcbr)\b/i.test(clean)) {
    return false;
  }

  // Reject banners and ERP table headers
  if (/^(?:academic\s+year|student\s+attendance|printed\s+on|faculty\s*:|course\s+code|course\s+description|attendance\s+report|semester\s+[ivx0-9]+)/i.test(clean)) {
    return false;
  }

  return true;
}

/**
 * Extracts a course code if present in the text.
 */
export function extractCourseCode(text: string): string | null {
  const match = text.match(COURSE_CODE_REGEX);
  return match ? match[1] : null;
}

/**
 * Normalizes subject name for comparison and merging.
 */
export function normalizeSubjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein distance between two strings for conservative typo matching.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= an; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bn; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[an][bn];
}

/**
 * Computes a conservative similarity score between 0.0 and 1.0.
 */
export function computeSubjectSimilarity(a: string, b: string): number {
  const normA = normalizeSubjectName(a);
  const normB = normalizeSubjectName(b);
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / maxLen;
}

/**
 * Checks whether an acronym matches a full subject name (e.g. "ASE" matches "Adaptive Software Engineering").
 */
export function isAcronymOf(acronym: string, fullName: string): boolean {
  const acr = acronym.toUpperCase().trim();
  if (acr.length < 2 || acr.length > 6) return false;

  const words = fullName
    .split(/[\s-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !RESERVED_WORDS.has(w.toLowerCase()));

  if (words.length < 2) return false;

  const initials = words.map((w) => w[0].toUpperCase()).join('');
  return initials === acr || initials.startsWith(acr);
}

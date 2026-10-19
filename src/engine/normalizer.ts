/**
 * Normalizes user input text by cleaning up strange whitespace,
 * unicode artifacts, and standardizing line breaks while preserving
 * table columns and sentence boundaries.
 */
export function normalizeInputText(text: string): string {
  if (!text) return '';

  return (
    text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Replace non-breaking spaces and zero-width spaces
      .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
      // Standardize quotes and hyphens
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      // Clean up trailing spaces on lines
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
  );
}

/**
 * Splits text into tokens while preserving separators that denote structure.
 */
export function tokenizeLine(line: string): string[] {
  // If line contains tabs, split by tab
  if (line.includes('\t')) {
    return line.split('\t').map((s) => s.trim()).filter(Boolean);
  }
  // If line contains pipes, split by pipe
  if (line.includes('|')) {
    return line.split('|').map((s) => s.trim()).filter(Boolean);
  }
  // If line contains commas and multiple words, split by comma if appropriate
  // Otherwise split by 2 or more spaces (table alignment)
  const multiSpaceMatch = line.split(/\s{2,}/);
  if (multiSpaceMatch.length > 2) {
    return multiSpaceMatch.map((s) => s.trim()).filter(Boolean);
  }

  // Fallback to word tokens
  return line.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

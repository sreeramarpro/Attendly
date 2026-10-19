import type { ComponentType } from '../types/attendance.js';

export const COMPONENT_PATTERNS: Record<ComponentType, RegExp> = {
  lecture: /\b(?:lecture|lectures|lectuer|lectuers|lectre|lectres|theory|theories|lec|lecs|th)\b/i,
  tutorial: /\b(?:tutorial|tutorials|tut|tuts)\b/i,
  practical: /\b(?:practical|practicals|practcal|practcals|practicle|practicles|lab|labs|laboratory|laboratories|prac|pracs)\b/i,
  skill: /\b(?:skill|skills|skl|skls|skill\s+class)\b/i,
  general: /\b(?:class|classes|session|sessions)\b/i,
};

export const SHORT_COMPONENT_LETTERS: Record<string, ComponentType> = {
  L: 'lecture',
  l: 'lecture',
  lec: 'lecture',
  lecs: 'lecture',
  lectuer: 'lecture',
  lectuers: 'lecture',
  lectre: 'lecture',
  T: 'tutorial',
  t: 'tutorial',
  tut: 'tutorial',
  tuts: 'tutorial',
  P: 'practical',
  p: 'practical',
  prac: 'practical',
  pracs: 'practical',
  practcal: 'practical',
  practcals: 'practical',
  practicle: 'practical',
  practicles: 'practical',
  S: 'skill',
  s: 'skill',
  skl: 'skill',
  skls: 'skill',
};

/**
 * Detects component type from a word or phrase, supporting abbreviations and common typos.
 */
export function detectComponentType(text: string): { type: ComponentType; name: string } | null {
  const trimmed = text.trim();

  // Short letter or abbreviation check (e.g. "L", "T", "P", "S", "lec", "tut", "prac", "skl")
  if (SHORT_COMPONENT_LETTERS[trimmed] || SHORT_COMPONENT_LETTERS[trimmed.toLowerCase()]) {
    const type = SHORT_COMPONENT_LETTERS[trimmed] || SHORT_COMPONENT_LETTERS[trimmed.toLowerCase()];
    return {
      type,
      name: formatComponentName(type),
    };
  }

  // Regex check for words with typo tolerance
  if (COMPONENT_PATTERNS.lecture.test(trimmed)) {
    return { type: 'lecture', name: 'Lecture' };
  }
  if (COMPONENT_PATTERNS.practical.test(trimmed)) {
    return { type: 'practical', name: 'Practical' };
  }
  if (COMPONENT_PATTERNS.tutorial.test(trimmed)) {
    return { type: 'tutorial', name: 'Tutorial' };
  }
  if (COMPONENT_PATTERNS.skill.test(trimmed)) {
    return { type: 'skill', name: 'Skill' };
  }

  return null;
}

export function formatComponentName(type: ComponentType): string {
  switch (type) {
    case 'lecture':
      return 'Lecture';
    case 'practical':
      return 'Practical';
    case 'tutorial':
      return 'Tutorial';
    case 'skill':
      return 'Skill';
    case 'general':
      return 'General';
  }
}

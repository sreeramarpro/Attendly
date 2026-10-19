import type {
  MergeSuggestion,
  ParsingWarning,
  SubjectRecord,
} from '../types/attendance.js';
import { computeSubjectSimilarity, isAcronymOf, normalizeSubjectName } from './subjectDetector.js';

/**
 * Merges repeated subject mentions safely, detecting conflicts and creating merge suggestions.
 */
export function mergeSubjectsSafely(
  subjects: SubjectRecord[]
): {
  mergedSubjects: SubjectRecord[];
  warnings: ParsingWarning[];
  mergeSuggestions: MergeSuggestion[];
} {
  const mergedSubjects: SubjectRecord[] = [];
  const warnings: ParsingWarning[] = [];
  const mergeSuggestions: MergeSuggestion[] = [];

  // Group by exact course code or exact normalized name
  const codeMap = new Map<string, SubjectRecord>();
  const nameMap = new Map<string, SubjectRecord>();

  for (const subject of subjects) {
    const normName = normalizeSubjectName(subject.name);
    const code = subject.code?.toUpperCase();

    // Check if we already have this subject by code
    let existing: SubjectRecord | undefined = code ? codeMap.get(code) : undefined;

    // If not found by code, check by exact normalized name
    if (!existing) {
      existing = nameMap.get(normName);
    }

    if (existing) {
      // Merge components safely into existing subject
      // Check for conflicts: duplicate component with different counts
      for (const newComp of subject.components) {
        const existingCompIndex = existing.components.findIndex(
          (c) => c.type === newComp.type
        );

        if (existingCompIndex >= 0) {
          const existingComp = existing.components[existingCompIndex];
          // Check if counts are different
          const attendedDiffers =
            existingComp.attended !== null &&
            newComp.attended !== null &&
            existingComp.attended !== newComp.attended;
          const conductedDiffers =
            existingComp.conducted !== null &&
            newComp.conducted !== null &&
            existingComp.conducted !== newComp.conducted;

          if (attendedDiffers || conductedDiffers) {
            // Flag duplicate component with differing counts
            warnings.push({
              id: `warn-dup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              subjectId: existing.id,
              subjectName: existing.name,
              type: 'potential_duplicate',
              message: `Potential duplicate detected for "${existing.name}" (${newComp.name}): ${existingComp.attended}/${existingComp.conducted} vs ${newComp.attended}/${newComp.conducted}. Does the second entry replace the first or represent additional classes?`,
              snippet: `${newComp.sourceSnippet} vs ${existingComp.sourceSnippet}`,
              suggestedAction: 'Confirm whether the second entry replaces the first or represents additional classes.',
              resolvable: true,
              details: {
                existingComp,
                newComp,
              },
            });

            warnings.push({
              id: `warn-conflict-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              subjectId: existing.id,
              subjectName: existing.name,
              type: 'contradicting_records',
              message: `Conflicting records found for "${existing.name}" (${newComp.name}): ${existingComp.attended}/${existingComp.conducted} vs ${newComp.attended}/${newComp.conducted}.`,
              snippet: `${newComp.sourceSnippet} vs ${existingComp.sourceSnippet}`,
              suggestedAction: 'Select or edit the correct counts in the review panel.',
              resolvable: true,
              details: {
                existingComp,
                newComp,
              },
            });
            // Keep the existing record without silently overwriting
          }
          // If counts are identical, it's just a duplicate mention, ignore duplicate
        } else {
          // New component for this subject! Add it
          existing.components.push(newComp);
        }
      }

      // Update code if existing was missing it
      if (!existing.code && subject.code) {
        existing.code = subject.code;
        codeMap.set(subject.code.toUpperCase(), existing);
      }
      // If the new name is longer/more descriptive, adopt it
      if (subject.name.length > existing.name.length && !isAcronymOf(existing.name, subject.name)) {
        existing.name = subject.name;
      }
    } else {
      // New distinct subject
      const fresh: SubjectRecord = {
        ...subject,
        components: [...subject.components],
      };
      mergedSubjects.push(fresh);
      if (code) {
        codeMap.set(code, fresh);
      }
      nameMap.set(normName, fresh);
    }
  }

  // Next, identify potential merge suggestions for acronyms or fuzzy matches (e.g. "ASE" and "Adaptive Software Engineering", or "Phyics" and "Physics")
  for (let i = 0; i < mergedSubjects.length; i++) {
    for (let j = i + 1; j < mergedSubjects.length; j++) {
      const a = mergedSubjects[i];
      const b = mergedSubjects[j];

      // Don't suggest merge if both have different explicit course codes
      if (a.code && b.code && a.code.toUpperCase() !== b.code.toUpperCase()) {
        continue;
      }

      const isAcrA = isAcronymOf(a.name, b.name);
      const isAcrB = isAcronymOf(b.name, a.name);

      if (isAcrA || isAcrB) {
        const shortSubj = isAcrA ? a : b;
        const longSubj = isAcrA ? b : a;

        mergeSuggestions.push({
          id: `merge-${shortSubj.id}-${longSubj.id}`,
          subjectAId: shortSubj.id,
          subjectAName: shortSubj.name,
          subjectBId: longSubj.id,
          subjectBName: longSubj.name,
          reason: `"${shortSubj.name}" appears to be an abbreviation for "${longSubj.name}".`,
          confidence: 0.85,
        });
      } else {
        const similarity = computeSubjectSimilarity(a.name, b.name);
        if (similarity >= 0.75) {
          mergeSuggestions.push({
            id: `merge-${a.id}-${b.id}`,
            subjectAId: a.id,
            subjectAName: a.name,
            subjectBId: b.id,
            subjectBName: b.name,
            reason: `"${a.name}" and "${b.name}" appear to be the same subject (${Math.round(similarity * 100)}% match).`,
            confidence: similarity,
          });

          warnings.push({
            id: `warn-dup-subj-${a.id}-${b.id}`,
            subjectId: a.id,
            subjectName: a.name,
            type: 'potential_duplicate',
            message: `Potential duplicate subject detected: "${a.name}" and "${b.name}" may be the same subject.`,
            suggestedAction: 'Confirm whether these subjects should be merged.',
            resolvable: true,
          });
        }
      }
    }
  }

  return {
    mergedSubjects,
    warnings,
    mergeSuggestions,
  };
}

import type { SubjectCalculation } from '../types/attendance.js';

/**
 * Converts subject calculations into CSV format, preserving validation status
 * so that invalid or unverified records are never presented as verified.
 */
export function exportToCSV(calculations: SubjectCalculation[]): string {
  const headers = [
    'Course Code',
    'Subject Name',
    'Component',
    'Attended',
    'Conducted',
    'Absent',
    'Weight',
    'Component %',
    'Weighted Attended',
    'Weighted Conducted',
    'Overall %',
    'Calculation Method',
    'Validation Status',
    'Validation Reason',
  ];

  const rows: string[][] = [headers];

  for (const sub of calculations) {
    if (sub.components.length === 0) {
      rows.push([
        escapeCSV(sub.subjectCode ?? ''),
        escapeCSV(sub.subjectName),
        'N/A',
        '',
        '',
        '',
        '',
        '',
        sub.totalWeightedAttended.toFixed(2),
        sub.totalWeightedConducted.toFixed(2),
        sub.formattedPercentage,
        sub.method,
        sub.validationStatus,
        escapeCSV(sub.validationReason ?? ''),
      ]);
    } else {
      for (const comp of sub.components) {
        rows.push([
          escapeCSV(sub.subjectCode ?? ''),
          escapeCSV(sub.subjectName),
          escapeCSV(comp.name),
          comp.attended !== null ? String(comp.attended) : '',
          comp.conducted !== null ? String(comp.conducted) : '',
          comp.absent !== null ? String(comp.absent) : '',
          comp.weight.toFixed(2),
          comp.formattedPercentage,
          comp.weightedAttended.toFixed(2),
          comp.weightedConducted.toFixed(2),
          sub.formattedPercentage,
          sub.method,
          comp.validationStatus,
          escapeCSV(comp.validationReason ?? ''),
        ]);
      }
    }
  }

  return rows.map((r) => r.join(',')).join('\r\n');
}

/**
 * Converts calculations to Tab-Separated Values (TSV) for pasting directly into Excel/Google Sheets.
 */
export function exportToTSV(calculations: SubjectCalculation[]): string {
  const headers = [
    'Course Code',
    'Subject Name',
    'Components',
    'Attended',
    'Conducted',
    'Absent',
    'Weighted Attended',
    'Weighted Conducted',
    'Attendance %',
    'Method',
    'Validation Status',
    'Validation Reason',
  ];

  const lines: string[] = [headers.join('\t')];

  for (const sub of calculations) {
    const compSummary = sub.components
      .map(
        (c) =>
          `${c.name}: ${c.attended ?? '-'}/${c.conducted ?? '-'}${
            c.validationStatus !== 'valid' ? ` [${c.validationStatus.toUpperCase()}]` : ''
          }`
      )
      .join('; ');

    const row = [
      sub.subjectCode ?? '',
      sub.subjectName,
      compSummary,
      String(sub.totalAttended),
      String(sub.totalConducted),
      String(sub.totalAbsent),
      sub.totalWeightedAttended.toFixed(2),
      sub.totalWeightedConducted.toFixed(2),
      sub.formattedPercentage,
      sub.method,
      sub.validationStatus,
      sub.validationReason ?? '',
    ];
    lines.push(row.join('\t'));
  }

  return lines.join('\r\n');
}

/**
 * Formats a single subject calculation for clipboard copying.
 */
export function formatSingleSubjectText(sub: SubjectCalculation): string {
  const lines: string[] = [];
  lines.push(`Subject: ${sub.subjectName}${sub.subjectCode ? ` [${sub.subjectCode}]` : ''}`);
  lines.push(
    `Overall Attendance: ${sub.formattedPercentage} (${sub.method})${
      sub.statusMessage ? ` [Status: ${sub.statusMessage}]` : ''
    }`
  );
  lines.push(
    `Validation Status: ${sub.validationStatus.toUpperCase()}${
      sub.validationReason ? ` - ${sub.validationReason}` : ''
    }`
  );
  lines.push(
    `Weighted Attended: ${sub.totalWeightedAttended.toFixed(2)} / Weighted Conducted: ${sub.totalWeightedConducted.toFixed(2)}`
  );
  lines.push('Components:');
  for (const c of sub.components) {
    const validTag =
      c.validationStatus === 'valid'
        ? ''
        : ` [${c.validationStatus.toUpperCase()}: ${c.validationReason || 'Error'}] (Excluded from calculation)`;
    lines.push(
      ` - ${c.name} (weight: ${c.weight}): ${c.attended ?? '-'}/${c.conducted ?? '-'} (${c.formattedPercentage})${validTag}`
    );
  }
  lines.push(`Formula: ${sub.formulaExplanation}`);
  return lines.join('\n');
}

/**
 * Formats all subject calculations as human-readable summary text.
 */
export function formatAllSubjectsText(calculations: SubjectCalculation[]): string {
  const lines: string[] = [
    '=== Attendly - Attendance Report ===',
    `Generated on: ${new Date().toLocaleDateString()}`,
    '',
  ];

  for (const sub of calculations) {
    lines.push(formatSingleSubjectText(sub));
    lines.push('----------------------------------------');
  }

  return lines.join('\n');
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

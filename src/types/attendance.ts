export type ComponentType = 'lecture' | 'tutorial' | 'practical' | 'skill' | 'general';

export type ValidationStatus = 'valid' | 'invalid' | 'unverified';

export interface ComponentRecord {
  id: string;
  type: ComponentType;
  name: string; // e.g., "Lecture", "Practical", "Tutorial", "Skill", "Theory", "Lab"
  attended: number | null;
  conducted: number | null;
  absent: number | null;
  percentage?: number | null; // explicit or calculated
  weight: number;
  confidence: 'high' | 'medium' | 'low' | 'inferred';
  source?: 'table' | 'sentence' | 'manual';
  sourceSnippet?: string;
  isManual?: boolean;
  isAbsentDerived?: boolean;
  validationStatus?: ValidationStatus;
  validationReason?: string;
}

export interface CanonicalAttendanceRecord {
  subjectName: string;
  subjectCode?: string;
  componentType: ComponentType;
  componentName?: string;
  conducted: number | null;
  attended: number | null;
  absent: number | null;
  source: 'table' | 'sentence' | 'manual';
  confidence: 'high' | 'medium' | 'low' | 'inferred';
  validationStatus?: ValidationStatus;
  validationReason?: string;
}

export interface SubjectRecord {
  id: string;
  name: string;
  code?: string;
  components: ComponentRecord[];
  notes?: string[];
  isPartial?: boolean;
  rawTextSnippet?: string;
  validationStatus?: ValidationStatus;
  validationReason?: string;
}

export type CalculationMethod = 'raw-count' | 'erp-percentage';

export interface ComponentWeights {
  lecture: number;
  tutorial: number;
  practical: number;
  skill: number;
  general: number;
}

export const DEFAULT_WEIGHTS: ComponentWeights = {
  lecture: 1.0,
  tutorial: 1.0,
  practical: 0.5,
  skill: 0.25,
  general: 1.0,
};

export interface CalculationSettings {
  weights: ComponentWeights;
  method: CalculationMethod;
  targetPercentage?: number; // e.g. 75 or 85
}

export interface ComponentCalculation {
  componentId: string;
  name: string;
  type: ComponentType;
  attended: number | null;
  conducted: number | null;
  absent: number | null;
  weight: number;
  percentage: number | null;
  formattedPercentage: string;
  weightedAttended: number;
  weightedConducted: number;
  sourceSnippet?: string;
  validationStatus: ValidationStatus;
  validationReason?: string;
}

export interface SubjectCalculation {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  method: CalculationMethod;
  components: ComponentCalculation[];
  totalAttended: number;
  totalConducted: number;
  totalAbsent: number;
  totalWeightedAttended: number;
  totalWeightedConducted: number;
  overallPercentage: number | null;
  formattedPercentage: string;
  isValid: boolean;
  hasWarnings: boolean;
  formulaExplanation: string;
  targetAnalysis?: {
    target: number;
    current: number;
    status: 'above' | 'on_track' | 'below';
    classesNeeded: number; // to reach target
    classesCanMiss: number; // while staying at or above target
  };
  warnings: ParsingWarning[];
  validationStatus: ValidationStatus;
  validationReason?: string;
  isPartiallyValid: boolean;
  validComponentsCount: number;
  invalidComponentsCount: number;
  unverifiedComponentsCount: number;
  statusMessage?: string;
}

export type WarningType =
  | 'attended_exceeds_conducted'
  | 'missing_counts'
  | 'ambiguous_values'
  | 'contradicting_records'
  | 'potential_duplicate'
  | 'zero_conducted'
  | 'unrecognized_token';

export interface ParsingWarning {
  id: string;
  subjectId?: string;
  subjectName?: string;
  componentId?: string;
  type: WarningType;
  message: string;
  snippet?: string;
  suggestedAction?: string;
  resolvable?: boolean;
  details?: Record<string, unknown>;
}

export interface MergeSuggestion {
  id: string;
  subjectAId: string;
  subjectAName: string;
  subjectBId: string;
  subjectBName: string;
  reason: string;
  confidence: number;
}

export interface ParseResult {
  subjects: SubjectRecord[];
  warnings: ParsingWarning[];
  mergeSuggestions: MergeSuggestion[];
  rawInput: string;
  detectedFormat: 'table' | 'natural_language' | 'shorthand' | 'mixed' | 'empty';
  intent?: InputIntent;
  questionResult?: QuestionResult;
  projectionResult?: ProjectionResult;
  isAmbiguous?: boolean;
  clarificationPrompt?: string;
  conversationalMessage?: string;
}

export type InputIntent =
  | 'attendance_data'
  | 'attendance_question'
  | 'question'
  | 'projection'
  | 'conversational'
  | 'ambiguous'
  | 'erp_table'
  | 'empty';

export interface QuestionResult {
  isQuestion: boolean;
  questionType?: 'overall_attendance' | 'status' | 'general';
  message: string;
  hasData: boolean;
}

export interface ProjectionResult {
  isProjection: boolean;
  baselineAttended?: number;
  baselineConducted?: number;
  baselinePercentage?: number;
  futureAttendedDelta?: number;
  futureConductedDelta?: number;
  projectedAttended?: number;
  projectedConducted?: number;
  projectedPercentage?: number;
  percentageDelta?: number;
  targetPercentage?: number;
  classesNeeded?: number;
  classesCanMiss?: number;
  explanation: string;
  subjectName?: string;
}

export interface OverallCalculationSummary {
  totalSubjects: number;
  validSubjects: number;
  incompleteSubjects: number;
  warningSubjects: number;
  totalComponents: number;
  validComponentsCount: number;
  invalidComponentsCount: number;
  unverifiedComponentsCount: number;
  validationStatus: ValidationStatus;
  statusMessage?: string;
  grandTotalAttended: number;
  grandTotalConducted: number;
  grandTotalWeightedAttended: number;
  grandTotalWeightedConducted: number;
  grandOverallPercentage: number | null;
  formattedGrandPercentage: string;
  subjectCalculations: SubjectCalculation[];
  warnings: ParsingWarning[];
  mergeSuggestions: MergeSuggestion[];
  intent?: InputIntent;
  questionResult?: QuestionResult;
  projectionResult?: ProjectionResult;
  clarificationPrompt?: string;
  conversationalMessage?: string;
}

// LanguageTool API response types

export interface LtMatch {
  message: string;
  shortMessage: string;
  replacements: { value: string }[];
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  sentence: string;
  rule: {
    id: string;
    description: string;
    issueType: string;
    category: {
      id: string;
      name: string;
    };
    urls?: { value: string }[];
  };
  type: {
    typeName: string;
  };
  ignoreForIncompleteSentence: boolean;
}

export interface LtDetectedLanguage {
  name: string;
  code: string;
  confidence: number;
  source: string;
}

export interface LtLanguage {
  name: string;
  code: string;
  detectedLanguage: LtDetectedLanguage;
}

export interface LtSoftwareInfo {
  name: string;
  version: string;
  buildDate: string;
  apiVersion: number;
  status: string;
}

export interface LtCheckResponse {
  software: LtSoftwareInfo;
  warnings?: { incompleteResults: boolean };
  language: LtLanguage;
  matches: LtMatch[];
}

export interface LtLanguageEntry {
  name: string;
  code: string;
  longCode: string;
}

// Grouped issue types for better readability
export type IssueCategory =
  | 'SPELLING'
  | 'GRAMMAR'
  | 'STYLE'
  | 'PUNCTUATION'
  | 'TYPOGRAPHY'
  | 'OTHER';

export interface FormattedMatch {
  category: IssueCategory;
  ruleId: string;
  message: string;
  shortMessage: string;
  context: string;
  contextHighlight: string;
  suggestions: string[];
  offset: number;
  length: number;
}

export interface CheckResult {
  [key: string]: unknown;
  detectedLanguage: string;
  detectedLanguageCode: string;
  languageConfidence: number;
  totalMatches: number;
  matchesByCategory: Record<IssueCategory, number>;
  matches: FormattedMatch[];
  hasCriticalIssues: boolean;
}

// Versioned schema for structuredContent in tool responses.
// schemaVersion follows MAJOR.MINOR format independent of the package version.
// Increment MAJOR on breaking changes (fields removed/renamed/type-changed),
// increment MINOR when adding optional fields.
export interface StructuredCheckResult extends CheckResult {
  schemaVersion: string;
}
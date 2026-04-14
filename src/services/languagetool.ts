import { LT_API_URL, CHARACTER_LIMIT, ISSUE_TYPE_MAP } from '../constants.js';
import type {
  LtCheckResponse,
  LtLanguageEntry,
  CheckResult,
  FormattedMatch,
  IssueCategory,
} from '../types.js';
import type { AnnotationPart } from './markdown.js';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function getCredentials(): { username: string; apiKey: string } {
  const username = process.env.LT_USERNAME;
  const apiKey   = process.env.LT_API_KEY;

  if (!username || !apiKey) {
    throw new Error(
      'LanguageTool-Zugangsdaten fehlen. ' +
      'Bitte LT_USERNAME und LT_API_KEY als Umgebungsvariablen setzen.'
    );
  }

  return { username, apiKey };
}

// ---------------------------------------------------------------------------
// Low-level fetch helpers
// ---------------------------------------------------------------------------

async function ltPost(
  endpoint: string,
  params: Record<string, string>
): Promise<unknown> {
  const { username, apiKey } = getCredentials();

  const body = new URLSearchParams({
    username,
    apiKey,
    ...params,
  });

  const response = await fetch(`${LT_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `LanguageTool API Fehler ${response.status}: ${text || response.statusText}`
    );
  }

  return response.json();
}

async function ltGet(endpoint: string): Promise<unknown> {
  const response = await fetch(`${LT_API_URL}/${endpoint}`);
  if (!response.ok) {
    throw new Error(`LanguageTool API Fehler ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Issue-type mapping
// ---------------------------------------------------------------------------

function mapIssueType(issueType: string): IssueCategory {
  const mapped = ISSUE_TYPE_MAP[issueType.toLowerCase()];
  if (mapped) return mapped as IssueCategory;
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// Context highlight helper
// ---------------------------------------------------------------------------

function buildContextHighlight(match: import('../types.js').LtMatch): string {
  const { text, offset, length } = match.context;
  const before  = text.slice(0, offset);
  const problem = text.slice(offset, offset + length);
  const after   = text.slice(offset + length);
  return `${before}[${problem}]${after}`;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export async function checkText(
  text: string,
  language: string = 'auto',
  enabledOnly: boolean = false,
  picky: boolean = false,
  disabledRules: string[] = [],
  enabledRules: string[] = [],
  annotatedText?: AnnotationPart[],
): Promise<CheckResult> {
  if (text.length > CHARACTER_LIMIT) {
    throw new Error(
      `Text zu lang (${text.length} Zeichen). Maximum: ${CHARACTER_LIMIT} Zeichen.`
    );
  }

  const params: Record<string, string> = { language };

  if (annotatedText) {
    params['data'] = JSON.stringify({ annotation: annotatedText });
  } else {
    params['text'] = text;
  }

  if (picky)                        params['level']         = 'picky';
  if (enabledOnly)                  params['enabledOnly']   = 'true';
  if (disabledRules.length > 0)     params['disabledRules'] = disabledRules.join(',');
  if (enabledRules.length > 0)      params['enabledRules']  = enabledRules.join(',');

  const raw = await ltPost('check', params) as LtCheckResponse;

  // Build formatted matches
  const matches: FormattedMatch[] = raw.matches.map((m) => ({
    category:         mapIssueType(m.rule.issueType ?? m.type?.typeName ?? ''),
    ruleId:           m.rule.id,
    message:          m.message,
    shortMessage:     m.shortMessage || m.message,
    context:          m.context.text,
    contextHighlight: buildContextHighlight(m),
    suggestions:      m.replacements.slice(0, 5).map((r) => r.value),
    offset:           m.offset,
    length:           m.length,
  }));

  // Count per category
  const matchesByCategory: Record<IssueCategory, number> = {
    SPELLING: 0, GRAMMAR: 0, STYLE: 0, PUNCTUATION: 0, TYPOGRAPHY: 0, OTHER: 0,
  };
  for (const m of matches) {
    matchesByCategory[m.category]++;
  }

  const hasCriticalIssues =
    matchesByCategory.SPELLING > 0 || matchesByCategory.GRAMMAR > 0;

  return {
    detectedLanguage:     raw.language.detectedLanguage?.name ?? raw.language.name,
    detectedLanguageCode: raw.language.detectedLanguage?.code ?? raw.language.code,
    languageConfidence:   raw.language.detectedLanguage?.confidence ?? 1,
    totalMatches:         matches.length,
    matchesByCategory,
    matches,
    hasCriticalIssues,
  };
}

export async function listLanguages(): Promise<LtLanguageEntry[]> {
  const raw = await ltGet('languages') as LtLanguageEntry[];
  return raw.sort((a, b) => a.name.localeCompare(b.name));
}
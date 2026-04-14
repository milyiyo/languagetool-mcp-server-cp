export const LT_API_URL = 'https://api.languagetoolplus.com/v2';
export const CHARACTER_LIMIT = 40_000; // LanguageTool Pro limit per request

export const ISSUE_TYPE_MAP: Record<string, string> = {
  misspelling:   'SPELLING',
  grammar:       'GRAMMAR',
  style:         'STYLE',
  punctuation:   'PUNCTUATION',
  typographical: 'TYPOGRAPHY',
  whitespace:    'TYPOGRAPHY',
  formatting:    'TYPOGRAPHY',
};

export const CATEGORY_LABELS: Record<string, string> = {
  SPELLING:    '🔴 Rechtschreibung',
  GRAMMAR:     '🟠 Grammatik',
  STYLE:       '🔵 Stil',
  PUNCTUATION: '🟡 Zeichensetzung',
  TYPOGRAPHY:  '⚪ Typografie',
  OTHER:       '⚫ Sonstiges',
};
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkText } from '../services/languagetool.js';
import { markdownToAnnotatedText } from '../services/markdown.js';
import { CATEGORY_LABELS } from '../constants.js';
import type { CheckResult, FormattedMatch, IssueCategory, StructuredCheckResult } from '../types.js';

const SCHEMA_VERSION = '1.0';

// ---------------------------------------------------------------------------
// Markdown formatter
// ---------------------------------------------------------------------------

function formatResultMarkdown(result: CheckResult, inputText: string): string {
  const lines: string[] = [];

  const statusIcon = result.hasCriticalIssues ? '⚠️' : '✅';
  lines.push(`## ${statusIcon} Prüfergebnis`);
  lines.push('');
  lines.push(`**Erkannte Sprache:** ${result.detectedLanguage} (\`${result.detectedLanguageCode}\`)` +
    (result.languageConfidence < 0.9
      ? ` — Konfidenz: ${Math.round(result.languageConfidence * 100)} %`
      : ''));
  lines.push(`**Geprüfte Zeichen:** ${inputText.length}`);
  lines.push(`**Gefundene Hinweise:** ${result.totalMatches}`);
  lines.push('');

  if (result.totalMatches === 0) {
    lines.push('Keine Probleme gefunden – der Text sieht gut aus! 🎉');
    return lines.join('\n');
  }

  // Summary table
  lines.push('### Übersicht nach Kategorie');
  lines.push('');
  const categories = Object.entries(result.matchesByCategory) as [IssueCategory, number][];
  for (const [cat, count] of categories) {
    if (count > 0) {
      lines.push(`- ${CATEGORY_LABELS[cat] ?? cat}: **${count}**`);
    }
  }
  lines.push('');

  // Group matches by category
  const grouped = new Map<IssueCategory, FormattedMatch[]>();
  for (const m of result.matches) {
    if (!grouped.has(m.category)) grouped.set(m.category, []);
    grouped.get(m.category)!.push(m);
  }

  // Category order
  const order: IssueCategory[] = ['SPELLING', 'GRAMMAR', 'PUNCTUATION', 'STYLE', 'TYPOGRAPHY', 'OTHER'];

  for (const cat of order) {
    const items = grouped.get(cat);
    if (!items || items.length === 0) continue;

    lines.push(`### ${CATEGORY_LABELS[cat] ?? cat}`);
    lines.push('');

    for (const m of items) {
      lines.push(`**${m.shortMessage}**`);
      lines.push(`> \`${m.contextHighlight}\``);
      lines.push(`*${m.message}*`);
      if (m.suggestions.length > 0) {
        lines.push(`Vorschläge: ${m.suggestions.map((s) => `\`${s}\``).join(', ')}`);
      }
      lines.push(`Regel: \`${m.ruleId}\` · Position: ${m.offset}–${m.offset + m.length}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerCheckTools(server: McpServer): void {

  // --- lt_check_text --------------------------------------------------------

  server.registerTool(
    'lt_check_text',
    {
      title: 'Text auf Fehler prüfen',
      description: `Prüft einen Text über die LanguageTool Pro API auf Rechtschreibfehler, Grammatikfehler, Stilprobleme und typografische Fehler.

Erkennt die Sprache automatisch (z. B. Deutsch, Englisch, Französisch) und gibt kategorisierte Hinweise mit Korrekturvorschlägen zurück.

Args:
  - text (string): Der zu prüfende Text (max. 40.000 Zeichen)
  - language (string): Sprachcode, z. B. "de-DE", "en-GB" oder "auto" für automatische Erkennung (Standard: "auto")
  - picky (boolean): Aktiviert strengere Prüfung mit mehr Stil-Hinweisen (Standard: false)
  - disabled_rules (string[]): Liste von Regel-IDs, die ignoriert werden sollen (z. B. ["WHITESPACE_RULE"])
  - enabled_rules (string[]): Liste zusätzlicher Regel-IDs, die aktiviert werden sollen

Returns:
  Markdown-formatierter Bericht mit:
  - Erkannter Sprache und Konfidenz
  - Anzahl Hinweise pro Kategorie (Rechtschreibung, Grammatik, Stil, Zeichensetzung, Typografie)
  - Detaillierte Hinweise mit Kontext, Erklärung und Korrekturvorschlägen

Beispiele:
  - Einfache Prüfung: { text: "Das ist ein Tset." }
  - Englisch explizit: { text: "This is a test.", language: "en-US" }
  - Strenger Modus: { text: "Das Ergebnis ist sehr gut.", picky: true }
  - Mit deaktivierten Regeln: { text: "...", disabled_rules: ["COMMA_PARENTHESIS_WHITESPACE"] }`,
      inputSchema: z.object({
        text: z.string()
          .min(1, 'Text darf nicht leer sein')
          .max(40_000, 'Text zu lang – maximum 40.000 Zeichen')
          .describe('Der zu prüfende Text'),
        language: z.string()
          .default('auto')
          .describe('Sprachcode (z. B. "de-DE", "en-US") oder "auto" für automatische Erkennung'),
        picky: z.boolean()
          .default(false)
          .describe('Strengere Prüfung mit mehr Stil-Hinweisen aktivieren'),
        disabled_rules: z.array(z.string())
          .default([])
          .describe('Regel-IDs, die ignoriert werden sollen'),
        enabled_rules: z.array(z.string())
          .default([])
          .describe('Zusätzliche Regel-IDs, die aktiviert werden sollen'),
        format: z.enum(['plain', 'markdown'])
          .default('plain')
          .describe('Textformat: "plain" für reinen Text, "markdown" für Markdown (Markup-Elemente wie Code-Blöcke, Links und Formatierungen werden bei der Prüfung übersprungen)'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ text, language, picky, disabled_rules, enabled_rules, format }) => {
      try {
        const annotatedText = format === 'markdown'
          ? markdownToAnnotatedText(text)
          : undefined;
        const effectiveDisabledRules = format === 'markdown'
          ? [...new Set(['WHITESPACE_RULE', ...disabled_rules])]
          : disabled_rules;
        const result = await checkText(text, language, false, picky, effectiveDisabledRules, enabled_rules, annotatedText);
        const markdown = formatResultMarkdown(result, text);
        const structured: StructuredCheckResult = { ...result, schemaVersion: SCHEMA_VERSION };
        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: structured,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `❌ Fehler bei der Textprüfung: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // --- lt_check_text_summary (kurze Zusammenfassung ohne Details) -----------

  server.registerTool(
    'lt_check_text_summary',
    {
      title: 'Textprüfung – Kurzübersicht',
      description: `Prüft einen Text und gibt nur eine kompakte Zusammenfassung der Fehleranzahl zurück – ohne detaillierte Einzelhinweise.

Nützlich, wenn schnell überprüft werden soll, ob ein Text Probleme hat, ohne eine vollständige Analyse zu lesen.

Args:
  - text (string): Der zu prüfende Text (max. 40.000 Zeichen)
  - language (string): Sprachcode oder "auto" (Standard)
  - picky (boolean): Strengere Prüfung (Standard: false)

Returns:
  Einzeilige Zusammenfassung mit Anzahl der Probleme pro Kategorie.`,
      inputSchema: z.object({
        text: z.string()
          .min(1)
          .max(40_000)
          .describe('Der zu prüfende Text'),
        language: z.string()
          .default('auto')
          .describe('Sprachcode oder "auto"'),
        picky: z.boolean()
          .default(false)
          .describe('Strengere Prüfung aktivieren'),
        format: z.enum(['plain', 'markdown'])
          .default('plain')
          .describe('Textformat: "plain" für reinen Text, "markdown" für Markdown'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ text, language, picky, format }) => {
      try {
        const annotatedText = format === 'markdown'
          ? markdownToAnnotatedText(text)
          : undefined;
        const effectiveDisabledRules = format === 'markdown' ? ['WHITESPACE_RULE'] : [];
        const result = await checkText(text, language, false, picky, effectiveDisabledRules, [], annotatedText);

        const structured: StructuredCheckResult = { ...result, schemaVersion: SCHEMA_VERSION };

        if (result.totalMatches === 0) {
          return {
            content: [{ type: 'text', text: `✅ Keine Probleme gefunden. (Sprache: ${result.detectedLanguage})` }],
            structuredContent: structured,
          };
        }

        const parts: string[] = [];
        const { matchesByCategory: c } = result;
        if (c.SPELLING    > 0) parts.push(`${c.SPELLING} Rechtschreibfehler`);
        if (c.GRAMMAR     > 0) parts.push(`${c.GRAMMAR} Grammatikfehler`);
        if (c.PUNCTUATION > 0) parts.push(`${c.PUNCTUATION} Zeichensetzungsfehler`);
        if (c.STYLE       > 0) parts.push(`${c.STYLE} Stilhinweise`);
        if (c.TYPOGRAPHY  > 0) parts.push(`${c.TYPOGRAPHY} Typografiefehler`);
        if (c.OTHER       > 0) parts.push(`${c.OTHER} sonstige Hinweise`);

        const summary = `⚠️ ${result.totalMatches} Hinweise in »${result.detectedLanguage}«: ${parts.join(', ')}.`;

        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: structured,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `❌ Fehler: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
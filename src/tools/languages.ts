import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listLanguages } from '../services/languagetool.js';

export function registerLanguageTools(server: McpServer): void {

  server.registerTool(
    'lt_list_languages',
    {
      title: 'Unterstützte Sprachen auflisten',
      description: `Gibt alle Sprachen zurück, die LanguageTool unterstützt.

Nützlich, um den korrekten Sprachcode für lt_check_text herauszufinden.

Returns:
  Liste aller unterstützten Sprachen mit Name, Kurzcode und Langcode.
  Beispiel: { name: "German (Germany)", code: "de", longCode: "de-DE" }`,
      inputSchema: z.object({
        filter: z.string()
          .optional()
          .describe('Optionaler Suchbegriff, um Ergebnisse zu filtern (z. B. "German", "de")'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ filter }) => {
      try {
        let languages = await listLanguages();

        if (filter) {
          const f = filter.toLowerCase();
          languages = languages.filter(
            (l) =>
              l.name.toLowerCase().includes(f) ||
              l.code.toLowerCase().includes(f) ||
              l.longCode.toLowerCase().includes(f)
          );
        }

        if (languages.length === 0) {
          return {
            content: [{ type: 'text', text: `Keine Sprachen gefunden für Filter: "${filter}"` }],
          };
        }

        const lines = languages.map(
          (l) => `- **${l.name}** — Code: \`${l.longCode}\``
        );

        const text = `## Unterstützte Sprachen (${languages.length})\n\n${lines.join('\n')}`;

        return {
          content: [{ type: 'text', text }],
          structuredContent: { languages },
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
// Converts Markdown to LanguageTool AnnotatedText format using remark-parse.
//
// LanguageTool's `data` parameter accepts an annotation array where each
// element is either:
//   { text: "..." }           – checked for errors
//   { markup: "...", interpretAs?: "..." } – skipped (markup region)
//
// Reference: https://languagetool.org/http-api/swagger-ui/#!/default/post_check

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Node, Parent } from 'mdast';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AnnotationPart =
  | { text: string }
  | { markup: string; interpretAs?: string };

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * A region of the source markdown string that should be treated as markup
 * (i.e. not spell-checked). start is inclusive, end is exclusive (0-based
 * character offsets into the original string).
 */
interface MarkupRegion {
  start: number;
  end: number;
  interpretAs?: string;
}

// ---------------------------------------------------------------------------
// MarkdownParser interface (adapter contract)
// ---------------------------------------------------------------------------

/**
 * Adapter interface for the markdown parser. Allows dependency injection in
 * markdownToAnnotatedText and makes the implementation swappable without
 * touching the public API.
 */
interface MarkdownParser {
  extractMarkupRegions(markdown: string): MarkupRegion[];
}

// ---------------------------------------------------------------------------
// RemarkMarkdownParser – concrete adapter using unified + remark-parse
// ---------------------------------------------------------------------------

class RemarkMarkdownParser implements MarkdownParser {
  private readonly processor = unified().use(remarkParse).use(remarkGfm);

  extractMarkupRegions(markdown: string): MarkupRegion[] {
    const tree = this.processor.parse(markdown) as Root;
    const regions: MarkupRegion[] = [];
    this.visitNode(tree, markdown, regions);
    return regions;
  }

  // -------------------------------------------------------------------------
  // Tree traversal
  // -------------------------------------------------------------------------

  private visitNode(node: Node, markdown: string, regions: MarkupRegion[]): void {
    switch (node.type) {
      // Entire node becomes markup ─ not checked
      case 'code':
        this.addWholeNode(node, regions, '\n');
        break;

      // Inline elements: use 'X' as placeholder so LT treats them as a word.
      // Using '' would collapse surrounding spaces and trigger false positives
      // like "unnecessary space before (…)".
      case 'inlineCode':
      case 'image':
      case 'imageReference':
        this.addWholeNode(node, regions, 'X');
        break;

      case 'html':
      case 'definition':
      // GFM tables: pipe chars, alignment and separator rows create too much
      // noise for LanguageTool. Mark the entire table as markup.
      case 'table':
        this.addWholeNode(node, regions, '');
        break;

      // Links: syntax parts are markup, link text is kept for checking
      case 'link':
      case 'linkReference':
        this.visitLinkNode(node as Node & Parent, regions);
        break;

      // List items: mark the bullet/number marker (e.g. "- ", "* ", "1. ")
      // as markup so LT does not interpret hyphens as dashes or flags them
      // as unnecessary punctuation.
      case 'listItem': {
        const listItem = node as Node & Parent;
        const pos = listItem.position;
        if (pos && listItem.children.length > 0) {
          const firstChild = listItem.children[0];
          const listItemStart = pos.start.offset;
          const firstChildStart = firstChild.position?.start.offset;
          if (listItemStart != null && firstChildStart != null && firstChildStart > listItemStart) {
            regions.push({ start: listItemStart, end: firstChildStart });
          }
        }
        for (const child of listItem.children) {
          this.visitNode(child, markdown, regions);
        }
        break;
      }

      // All other nodes: recurse into children, no markup region for the node
      // itself (e.g. paragraph, heading, emphasis, strong, blockquote, etc.)
      default:
        if ('children' in node) {
          for (const child of (node as Parent).children) {
            this.visitNode(child, markdown, regions);
          }
        }
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Helper: mark an entire node as a single markup region
  // -------------------------------------------------------------------------

  private addWholeNode(
    node: Node,
    regions: MarkupRegion[],
    interpretAs: string,
  ): void {
    const pos = node.position;
    if (!pos) return;
    const start = pos.start.offset;
    const end = pos.end.offset;
    if (start == null || end == null) return;
    regions.push({ start, end, interpretAs });
  }

  // -------------------------------------------------------------------------
  // Helper: handle link / linkReference nodes
  //
  // Structure in source:   [link text](url)
  //                         ^         ^    ^
  //                         |         |    node.end
  //                         |         firstChild.end / lastChild.end
  //                         node.start
  //
  // We emit:
  //   markup  "[" (from node.start to firstChild.start)
  //   <recurse children>
  //   markup  "](url)" (from lastChild.end to node.end)
  // -------------------------------------------------------------------------

  private visitLinkNode(node: Node & Parent, regions: MarkupRegion[]): void {
    const pos = node.position;
    if (!pos) return;
    const nodeStart = pos.start.offset;
    const nodeEnd = pos.end.offset;
    if (nodeStart == null || nodeEnd == null) return;

    const children = node.children;

    if (children.length === 0) {
      // No children (e.g. empty link) – treat entire node as markup
      regions.push({ start: nodeStart, end: nodeEnd, interpretAs: '' });
      return;
    }

    const firstChild = children[0];
    const lastChild = children[children.length - 1];

    const firstChildStart = firstChild.position?.start.offset;
    const lastChildEnd = lastChild.position?.end.offset;

    if (firstChildStart == null || lastChildEnd == null) {
      // Fallback: mark whole node as markup if offsets are unavailable
      regions.push({ start: nodeStart, end: nodeEnd, interpretAs: '' });
      return;
    }

    // Opening bracket + anything before the first child's text
    if (firstChildStart > nodeStart) {
      regions.push({ start: nodeStart, end: firstChildStart });
    }

    // Recurse into children so nested markup is handled correctly
    for (const child of children) {
      this.visitNode(child, '', regions);
    }

    // Closing part: "](url)" or "]" etc.
    if (nodeEnd > lastChildEnd) {
      regions.push({ start: lastChildEnd, end: nodeEnd });
    }
  }
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

const defaultParser: MarkdownParser = new RemarkMarkdownParser();

/**
 * Converts a Markdown string to a LanguageTool AnnotatedText array.
 *
 * Markup syntax (code blocks, inline code, images, HTML, link syntax, etc.)
 * is wrapped in `{ markup }` parts so LanguageTool skips them. Plain text
 * content is wrapped in `{ text }` parts and will be spell/grammar checked.
 *
 * @param markdown - The Markdown source string.
 * @param parser   - Optional parser adapter (defaults to RemarkMarkdownParser).
 *                   Inject a custom implementation in tests or to swap parsers.
 */
export function markdownToAnnotatedText(
  markdown: string,
  parser: MarkdownParser = defaultParser,
): AnnotationPart[] {
  const regions = parser.extractMarkupRegions(markdown);

  // Sort regions by start position (ascending)
  const sorted = [...regions].sort((a, b) => a.start - b.start);

  const parts: AnnotationPart[] = [];
  let pos = 0;

  for (const region of sorted) {
    // Skip regions that start before the current cursor (overlap / duplicate)
    if (region.start < pos) continue;

    // Plain text segment before this markup region
    if (region.start > pos) {
      parts.push({ text: markdown.slice(pos, region.start) });
    }

    // Markup region
    const markupStr = markdown.slice(region.start, region.end);
    const part: { markup: string; interpretAs?: string } = { markup: markupStr };
    if (region.interpretAs !== undefined) {
      part.interpretAs = region.interpretAs;
    }
    parts.push(part);

    pos = region.end;
  }

  // Remaining text after the last markup region
  if (pos < markdown.length) {
    parts.push({ text: markdown.slice(pos) });
  }

  // Filter out empty parts that contribute nothing
  return parts.filter((p) =>
    'text' in p ? p.text.length > 0 : p.markup.length > 0,
  );
}

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-03-13

### Added
- `schemaVersion` field in `structuredContent` of all tool responses for programmatic compatibility checks
- New `StructuredCheckResult` interface in `src/types.ts` as versioned schema for `structuredContent`

## [1.0.0] — 2026-03-12

### Added
- `lt_check_text` tool: full text check with categorized suggestions (spelling, grammar, punctuation, style, typography)
- `lt_check_text_summary` tool: compact one-line summary of check results
- `lt_list_languages` tool: list all supported languages with optional filtering
- Automatic language detection (`language: auto`)
- Picky mode for stricter style checking
- `disabled_rules` / `enabled_rules` for fine-grained rule control
- Markdown-formatted output with category icons
- Structured JSON output via `structuredContent` for programmatic use
- Context highlight: erroneous passage marked with `[square brackets]`
- stdio transport (default, for local Claude Code / Claude Desktop use)
- Streamable HTTP transport (via `TRANSPORT=http` env variable)
- GFM table support and markdown whitespace noise suppression
- Support up to 40,000 characters (LanguageTool Pro limit)

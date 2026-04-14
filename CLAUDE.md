@.claude/lessons.md

# CLAUDE.md – Project context for Claude Code

This file gives Claude Code full context about the origin, design decisions, and open tasks of the `languagetool-mcp-server` project.

---

## What is this project?

An **MCP server** (Model Context Protocol) that integrates the **LanguageTool Pro API**, bringing spell-checking, grammar, style, and typography checks directly into Claude Code and other MCP-capable clients.

**Why was it built?** The project owner has a LanguageTool Pro subscription and wanted to make the API available to Claude via MCP — so that text Claude writes or revises can be checked against LanguageTool directly, without manual copy-pasting.

**Are there comparable projects?** No. A search on GitHub and Codeberg found no MCP server for the LanguageTool (Pro) API. The `mcp-language-server` and `languagetool-language-server` repos found are LSP servers (Language Server Protocol for code editors) — conceptually something entirely different. This project fills a real gap and is a good candidate for the official MCP server index.

---

## Tech stack and design decisions

### Language & framework
- **TypeScript** with the official `@modelcontextprotocol/sdk`
- Chose TypeScript (not Python/FastMCP) because: better SDK support, static typing, and the project owner works primarily with Node.js tools

### Transport
- **stdio** as default (for local Claude Code / Claude Desktop use)
- **HTTP** (Streamable HTTP) as alternative via `TRANSPORT=http` environment variable — for multi-client or remote scenarios
- Configured via `process.env.TRANSPORT`

### Project structure
```
src/
├── index.ts              ← Entry point, transport selection
├── types.ts              ← All TypeScript interfaces (LtMatch, CheckResult, etc.)
├── constants.ts          ← API URL, character limit, category mapping
├── services/
│   └── languagetool.ts   ← API client (fetch-based, no external HTTP libs)
└── tools/
    ├── check.ts          ← lt_check_text + lt_check_text_summary
    └── languages.ts      ← lt_list_languages
```

### Authentication
- Via environment variables `LT_USERNAME` (email) and `LT_API_KEY`
- No hardcoding, no config file — deliberate decision for maximum security and easy CI/CD compatibility
- API endpoint: `https://api.languagetoolplus.com/v2`

### LanguageTool features
The following features were deliberately included:
- **Automatic language detection** (`language: "auto"`) as default
- **Picky mode** (`level=picky`) for stricter style checking
- **disabled_rules / enabled_rules** for granular control
- Character limit: 40,000 characters (LanguageTool Pro limit)

### Output format
- Markdown-formatted report with categorization by: 🔴 Spelling, 🟠 Grammar, 🟡 Punctuation, 🔵 Style, ⚪ Typography, ⚫ Other
- Additionally `structuredContent` (JSON) in the tool response for programmatic processing
- Context highlight: the erroneous passage is marked with `[square brackets]`

---

## Available tools

| Tool name | Description |
|---|---|
| `lt_check_text` | Full check with categorized hints and suggestions |
| `lt_check_text_summary` | Single-line summary (number of issues per category) |
| `lt_list_languages` | All supported languages with language codes, optionally filterable |

---

## Versioning and compatibility promise

This project follows [Semantic Versioning 2.0.0](https://semver.org/) and is guided by the Symfony Backward Compatibility Promise: minor and patch releases must not cause unexpected side effects for existing integrations.

---

### What is the public API of this project?

The public API encompasses everything that MCP clients and external users rely on:

#### Tool interfaces (strictly stable)
- **Tool names:** `lt_check_text`, `lt_check_text_summary`, `lt_list_languages`
  — Renaming or removing is always a breaking change (→ major).
- **Parameter names and types:** Existing parameters must not be renamed,
  removed, or changed in semantics (→ major).
- **Required/optional status:** An optional parameter must not become
  required (→ major). The reverse is allowed (→ minor).
- **Parameter defaults:** Changes to default values count as a breaking change (→ major).

#### `structuredContent` schema (versioned, strictly stable)
The JSON object in the `structuredContent` field of the tool response is a versioned core feature.
It contains a `schemaVersion` field (e.g. `"1.0"`).

- Adding new optional fields → minor
- Removing or renaming existing fields → major
- Changing the type of an existing field → major
- `schemaVersion` is incremented with every breaking change

Current schema: see `src/types.ts`, interface `StructuredCheckResult`.

#### Environment variables (strictly stable)
Existing variables (`LT_USERNAME`, `LT_API_KEY`, `TRANSPORT`, `PORT`) must not
be renamed or removed in minor/patch releases (→ major).
Introducing new optional variables is allowed (→ minor).

#### Markdown output (partially stable)
- **Category keys** (🔴 Spelling, 🟠 Grammar, …) and their **order**
  in the output are stable (→ change is major).
- **Presentation details** (formatting, indentation, emoji style) may change
  in minor releases, as long as all information is fully preserved.
- Removing information is always breaking (→ major).

---

### What is internal and may change at any time?

- File structure under `src/` (module names, classes, internal functions)
- Internal TypeScript types that are not part of `structuredContent`
- Build configuration (`tsconfig.json`, `package.json` scripts)
- Developer tooling (lint, format, CI configuration)

---

### Versioning rules at a glance

| Change type                                          | Version   |
|------------------------------------------------------|-----------|
| Bug fix without behavior change                      | patch     |
| New optional tool parameter                          | minor     |
| New tool                                             | minor     |
| New optional environment variable                    | minor     |
| New optional fields in `structuredContent`           | minor     |
| Presentation change (Markdown, formatting)           | minor     |
| Tool name changed or removed                         | **major** |
| Required parameter added                             | **major** |
| Parameter default changed                            | **major** |
| Existing environment variable renamed/removed        | **major** |
| Fields in `structuredContent` removed/renamed        | **major** |
| `schemaVersion` incremented                          | **major** |
| Category key or order changed                        | **major** |

---

### Deprecation process

To remove something from the public API:

1. Mark as deprecated in a **minor** release (note in README and
   in the tool description in the MCP response).
2. Remove no earlier than the **next major** release.
3. Document in `CHANGELOG.md` under `### Deprecated`.

---

### Release checklist

Before every release:

- [ ] All changes since the last tag documented in `CHANGELOG.md`
- [ ] Version number set in `package.json`
- [ ] Git tag set (`git tag v1.2.3`)
- [ ] Verified: does the version type (patch/minor/major) match the rules above?
- [ ] For major: migration notes in CHANGELOG under `### Breaking Changes`
- [ ] For changes to `structuredContent`: `schemaVersion` updated and
      interface `StructuredCheckResult` in `src/types.ts` adjusted

---

### `schemaVersion` in `structuredContent`

Every tool response containing `structuredContent` provides:

```json
{
  "schemaVersion": "1.0",
  ...
}
```

Clients can evaluate this field to check compatibility.
The version follows the `MAJOR.MINOR` format independently of the package version.

---

## Configuration (Claude Desktop / Claude Code)

```json
{
  "mcpServers": {
    "languagetool": {
      "command": "npx",
      "args": ["-y", "@dpesch/languagetool-mcp-server"],
      "env": {
        "LT_USERNAME": "your@email.com",
        "LT_API_KEY": "your-api-key"
      }
    }
  }
}
```

Local build (replace path accordingly):
```json
{
  "mcpServers": {
    "languagetool": {
      "command": "node",
      "args": ["C:/dev.local/mcp-servers/languagetool-mcp-server/dist/index.js"],
      "env": {
        "LT_USERNAME": "your@email.com",
        "LT_API_KEY": "your-api-key"
      }
    }
  }
}
```

HTTP mode:
```bash
LT_USERNAME=... LT_API_KEY=... TRANSPORT=http PORT=3456 node dist/index.js
```

---

## Open-source setup: status

### Repository setup
- [x] Repository published on Codeberg: `codeberg.org/dpesch/languagetool-mcp-server`
- [x] Choose a license — **MIT** (LICENSE file present, package.json updated)
- [x] Create `.gitignore` for Node.js (`node_modules/`, `dist/`)
- [x] Create `CHANGELOG.md`
- [x] Create `CONTRIBUTING.md`

### package.json
- [x] `repository` field set (Codeberg URL)
- [x] `license` field set (`MIT`)
- [x] `keywords` set: `["mcp", "languagetool", "grammar", "spellcheck", "model-context-protocol"]`
- [x] `author` field set
- [x] `engines` field set: `{ "node": ">=18" }`

### CI/CD
- [ ] CI workflow for automatic build & test on push
- [x] Published on npm as `@dpesch/languagetool-mcp-server` (usable via `npx`)

### Documentation
- [x] README.md with badges (npm version, license)
- [ ] Apply for inclusion in the official MCP server index: https://github.com/modelcontextprotocol/servers

### Tests
- [ ] No tests yet — set up basic unit test structure with `vitest` or `jest`
- [ ] At minimum: mock tests for the API client and formatter functions

### Extension ideas (backlog)
- [ ] `lt_check_file` tool: check a file directly (e.g. Markdown)
- [ ] Support for self-hosted LanguageTool instances (custom `LT_API_URL` env variable — basic structure already prepared in `constants.ts`)
- [ ] `lt_get_rule_info` tool: fetch details for a rule ID
- [ ] Result cache (e.g. for repeated checks of the same text)

---

## SDK documentation via context7

The `@modelcontextprotocol/sdk` is actively developed. Always use context7 for up-to-date API documentation:
- Tool response format, `structuredContent`, transport classes
- Resolver: `@modelcontextprotocol/sdk`

---

## Style notes for this project

The project owner writes German texts and prefers:
- Quotation marks: »«
- Gender colon (Nutzer:innen), no gender star
- »allerdings« instead of »aber«
- »Vereinbarung« instead of »Vertrag«
- Correct typography (em dashes, narrow space before units, etc.)

For code and comments: English (international open-source convention).
For README and documentation: German (primary audience) + English (useful for international use — possibly a bilingual README).

---

## Local development environment

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → dist/
npm run typecheck    # Type check without output (fast, no dist/ write access)
npm run dev          # Watch mode for development
npm start            # Start server (stdio)
```

Set environment variables locally (PowerShell):
```powershell
$env:LT_USERNAME = "your@email.com"
$env:LT_API_KEY  = "your-api-key"
node dist/index.js
```

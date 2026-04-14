# languagetool-mcp-server

[![npm version](https://img.shields.io/npm/v/@dpesch/languagetool-mcp-server)](https://www.npmjs.com/package/@dpesch/languagetool-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MCP-Server für die **LanguageTool Pro API** – bringt Rechtschreib-, Grammatik- und Stilprüfung direkt in Claude Code und andere MCP-fähige Clients.

> **⚠️ LanguageTool Pro erforderlich** — Dieser Server nutzt die LanguageTool Pro API. Ein kostenpflichtiges [LanguageTool Pro-Abonnement](https://languagetool.org/pro) mit API-Zugang ist Voraussetzung. Der kostenlose Tarif bietet keinen API-Zugang.

📖 [English documentation](README.md)

---

## Voraussetzungen

- Node.js ≥ 18
- **LanguageTool Pro-Konto** mit API-Zugang ([Abonnement erforderlich](https://languagetool.org/pro))
- API-Zugangsdaten: Benutzername (E-Mail) + API-Key

Den API-Key findet man unter: https://languagetool.org/editor/settings/access-tokens

---

## Installation

Keine Installation nötig – `npx @dpesch/languagetool-mcp-server` direkt in der MCP-Konfiguration verwenden (siehe Einrichtung unten).

**Alternative – lokal klonen und bauen:**

```bash
git clone https://codeberg.org/dpesch/languagetool-mcp-server
cd languagetool-mcp-server
npm install
npm run build
```

---

## Zugangsdaten

Der Server liest die Zugangsdaten aus Umgebungsvariablen:

| Variable       | Beschreibung                              |
|---------------|-------------------------------------------|
| `LT_USERNAME` | LanguageTool-Benutzername (E-Mail-Adresse) |
| `LT_API_KEY`  | API-Key aus den Kontoeinstellungen        |

---

## Einrichtung in Claude Code (stdio – empfohlen für lokal)

In `~/.claude/claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "languagetool": {
      "command": "npx",
      "args": ["-y", "@dpesch/languagetool-mcp-server"],
      "env": {
        "LT_USERNAME": "deine@email.de",
        "LT_API_KEY":  "dein-api-key"
      }
    }
  }
}
```

**Bei lokalem Build** (`/pfad/zum/...` durch den tatsächlichen Pfad ersetzen):

```json
{
  "mcpServers": {
    "languagetool": {
      "command": "node",
      "args": ["/pfad/zum/languagetool-mcp-server/dist/index.js"],
      "env": {
        "LT_USERNAME": "deine@email.de",
        "LT_API_KEY":  "dein-api-key"
      }
    }
  }
}
```

---

## Einrichtung als HTTP-Server (für mehrere Clients)

```bash
# Server starten
LT_USERNAME=deine@email.de LT_API_KEY=dein-key TRANSPORT=http PORT=3456 node dist/index.js
```

Dann in der MCP-Konfiguration:

```json
{
  "mcpServers": {
    "languagetool": {
      "type": "http",
      "url": "http://localhost:3456/mcp"
    }
  }
}
```

Health-Check: `GET http://localhost:3456/health`

---

## Verfügbare Tools

### `lt_check_text`
Vollständige Textprüfung mit kategorisierten Hinweisen und Korrekturvorschlägen.

**Parameter:**
- `text` – der zu prüfende Text (max. 40.000 Zeichen)
- `language` – Sprachcode (`de-DE`, `en-US`, …) oder `auto` (Standard)
- `picky` – strengere Prüfung mit mehr Stil-Hinweisen (Standard: `false`)
- `disabled_rules` – Regel-IDs, die ignoriert werden sollen
- `enabled_rules` – zusätzliche Regel-IDs

### `lt_check_text_summary`
Kompakte Zusammenfassung (eine Zeile) ohne Einzeldetails – nützlich für schnelle Checks.

### `lt_list_languages`
Alle unterstützten Sprachen mit Sprachcodes. Optional mit `filter`-Parameter.

---

## Kategorien

| Symbol | Kategorie       |
|--------|----------------|
| 🔴     | Rechtschreibung |
| 🟠     | Grammatik       |
| 🟡     | Zeichensetzung  |
| 🔵     | Stil            |
| ⚪     | Typografie      |
| ⚫     | Sonstiges       |

---

## Entwicklung

```bash
# TypeScript im Watch-Modus
npm run dev

# Einmalig bauen
npm run build

# Type-Check ohne Build
npm run typecheck
```

---

## Lizenz

[MIT](LICENSE) © 2026 Dominik Pesch

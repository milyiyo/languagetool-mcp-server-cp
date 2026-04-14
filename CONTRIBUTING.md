# Contributing

Thank you for your interest in contributing to `languagetool-mcp-server`!

## Prerequisites

- Node.js ≥ 18
- A LanguageTool Pro account for integration testing (API credentials required)

## Setup

```bash
git clone https://codeberg.org/dpesch/languagetool-mcp-server
cd languagetool-mcp-server
npm install
npm run build
```

## Development

```bash
npm run dev       # TypeScript watch mode
npm run typecheck # Type check without emitting files
npm run build     # Single build
```

## Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/)
4. Push and open a pull request against `main`

Please describe **why** you made the change, not just what you changed.

## Reporting Issues

Open an issue on [Codeberg](https://codeberg.org/dpesch/languagetool-mcp-server/issues) with:
- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Node.js version and OS

## Code Style

- TypeScript strict mode
- No external HTTP libraries (use `fetch`)
- Keep the module structure: `services/` for API clients, `tools/` for MCP tools
- English for code and comments; German is welcome in issues and PRs

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

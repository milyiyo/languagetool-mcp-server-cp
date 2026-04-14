#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'http';
import { registerCheckTools } from './tools/check.js';
import { registerLanguageTools } from './tools/languages.js';

// ---------------------------------------------------------------------------
// Server Setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'languagetool-mcp-server',
  version: '1.0.0',
});

registerCheckTools(server);
registerLanguageTools(server);

// ---------------------------------------------------------------------------
// Transport: stdio (Standard) oder HTTP
// ---------------------------------------------------------------------------

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LanguageTool MCP Server läuft (stdio)');
}

async function runHttp(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '3456');

  const httpServer = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/mcp') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          });
          res.on('close', () => transport.close());
          await server.connect(transport);
          await transport.handleRequest(req, res, body);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request' }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: 'languagetool-mcp-server' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  httpServer.listen(port, () => {
    console.error(`LanguageTool MCP Server läuft auf http://localhost:${port}/mcp`);
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = process.env.TRANSPORT ?? 'stdio';

if (transport === 'http') {
  runHttp().catch((err: unknown) => {
    console.error('Server-Fehler:', err);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    console.error('Server-Fehler:', err);
    process.exit(1);
  });
}
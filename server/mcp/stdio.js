#!/usr/bin/env node
/**
 * Stdio entry point for Claude Desktop / Claude Code.
 * Run directly: node server/mcp/stdio.js
 *
 * Same server as the HTTP endpoint; only the transport differs.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
await server.connect(new StdioServerTransport());

#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const server = resolve(__dirname, '../dist/mcp-server.cjs');
const child = spawn('node', [server, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 0));

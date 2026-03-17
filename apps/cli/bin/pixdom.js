#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, '../src/index.ts');
const tsx = resolve(__dirname, '../node_modules/.bin/tsx');

const child = spawn(tsx, [entry, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));

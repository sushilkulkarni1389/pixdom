#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../dist/index.js');
const src = resolve(__dirname, '../src/index.ts');
const tsx = resolve(__dirname, '../node_modules/.bin/tsx');

const [cmd, args] = existsSync(dist)
  ? ['node', [dist, ...process.argv.slice(2)]]
  : [tsx, [src, ...process.argv.slice(2)]];

const child = spawn(cmd, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));

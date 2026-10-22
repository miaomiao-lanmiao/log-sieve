#!/usr/bin/env node
import { closeSync, constants, fstatSync, openSync, readSync, writeFileSync } from 'node:fs';
import { analyze } from './analyze.js';
import { render } from './render.js';
import { VERSION } from './version.js';

const help = `Log Sieve — offline log triage

Usage: logsieve analyze FILE [--format markdown|json|html] [--output NEW_FILE]
                            [--fail-on warning|error]
Use - as FILE to read UTF-8 stdin. No network calls or automated fixes.
--help shows help; --version shows version. Options use separate arguments.
Input: regular UTF-8 file/stdin, max 16 MiB, 100000 lines, 64 KiB per line.
Exit: 0 success, 1 invalid input/I/O, 2 requested warning/error threshold crossed.
Pattern redaction is incomplete: review every report before sharing.
`;

function readInput(path: string): string {
  let descriptor: number;
  try { descriptor = path === '-' ? 0 : openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0)); }
  catch { throw new Error('Cannot open input file.'); }
  try {
    if (path !== '-') {
      const stats = fstatSync(descriptor);
      if (!stats.isFile()) throw new Error('Input must be a regular file.');
      if (stats.size > 16 * 1024 * 1024) throw new Error('Input exceeds the 16 MiB limit.');
    }
    const chunks: Buffer[] = [];
    const buffer = Buffer.alloc(64 * 1024);
    let size = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (!count) break;
      size += count;
      if (size > 16 * 1024 * 1024) throw new Error('Input exceeds the 16 MiB limit.');
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { throw new Error('Input must contain valid UTF-8 text.'); }
  } finally { if (descriptor !== 0) closeSync(descriptor); }
}

process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0);
  process.stderr.write('logsieve: Cannot write output.\n'); process.exit(1);
});

try {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) process.stdout.write(help);
  else if (args.length === 1 && args[0] === '--version') process.stdout.write(`${VERSION}\n`);
  else {
    const input = args[1];
    if (args[0] !== 'analyze' || !input || (input.startsWith('-') && input !== '-')) throw new Error('Expected analyze FILE. Use --help for usage.');
    if (/[\x00-\x1f\x7f]/.test(input)) throw new Error('Input path contains control characters.');
    const flags = new Map<string, string>();
    for (let index = 2; index < args.length; index += 2) {
      const flag = args[index]!;
      const value = args[index + 1];
      if (!['--format', '--output', '--fail-on'].includes(flag) || flags.has(flag)) throw new Error('Unknown or duplicate option.');
      if (!value || value.startsWith('--') || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Option requires a value without control characters.');
      flags.set(flag, value);
    }
    const format = flags.get('--format') ?? 'markdown';
    if (format !== 'markdown' && format !== 'json' && format !== 'html') throw new Error('--format must be markdown, json, or html.');
    const threshold = flags.get('--fail-on');
    if (threshold !== undefined && threshold !== 'warning' && threshold !== 'error') throw new Error('--fail-on must be warning or error.');
    const report = analyze(readInput(input));
    const output = render(report, format);
    const path = flags.get('--output');
    if (path === undefined) process.stdout.write(output);
    else {
      try { writeFileSync(path, output, { encoding: 'utf8', flag: 'wx', mode: 0o600 }); }
      catch { throw new Error('Cannot create output file; it may already exist or its parent may be missing.'); }
    }
    if ((threshold === 'error' && report.counts.error + report.counts.fatal > 0)
      || (threshold === 'warning' && report.groups.length > 0)) process.exitCode = 2;
  }
} catch (error) {
  // Never include Node filesystem error text, which can echo private input paths.
  const message = error instanceof Error && !('code' in error) ? error.message : 'Cannot read input or write output.';
  process.stderr.write(`logsieve: ${message}\n`); process.exitCode = 1;
}

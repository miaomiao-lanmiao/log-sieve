import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'log sieve package '));
assert.ok(process.env.npm_execpath, 'Run with npm run check:package.');
function npm(args, cwd) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000,
    env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, result.stderr);
}
try {
  npm(['pack', '--ignore-scripts', '--pack-destination', temporary], root);
  const archive = join(temporary, readdirSync(temporary).find(file => file.endsWith('.tgz')));
  npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', temporary, archive], temporary);
  const cli = join(temporary, 'node_modules/log-sieve-cli/dist/cli.js');
  const result = spawnSync(process.execPath, [cli, 'analyze', '- ', '--format', 'json'], { encoding: 'utf8', input: 'ERROR test' });
  assert.equal(result.status, 1);
  const report = spawnSync(process.execPath, [cli, 'analyze', '-', '--format', 'json'], {
    encoding: 'utf8', input: 'ERROR ECONNREFUSED token=synthetic-package-token',
  });
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(report.stdout).counts.error, 1);
  assert.ok(!report.stdout.includes('synthetic-package-token'));
  const binDirectory = join(temporary, 'node_modules/.bin');
  const installed = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'logsieve.cmd --version'], { cwd: binDirectory, encoding: 'utf8', windowsHide: true })
    : spawnSync(join(binDirectory, 'logsieve'), ['--version'], { encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(installed.stdout, '0.1.0\n');
  console.log('Offline tarball installation, installed command, log parsing and synthetic credential redaction passed.');
} finally { rmSync(temporary, { recursive: true, force: true }); }

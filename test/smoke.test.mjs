import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const cli = resolve('dist/cli.js');
function run(args, input) {
  return spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 20 * 1024 * 1024 });
}
test('real CLI: files, stdin, every format, gates, output protection and errors', t => {
  const directory = mkdtempSync(join(tmpdir(), 'log sieve smoke '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = join(directory, '中文 file with spaces.log');
  const text = 'INFO start\nERROR ECONNREFUSED token=synthetic-cli-token\nERROR ECONNREFUSED token=other-synthetic-token\nWARN slow\n';
  writeFileSync(input, text);
  for (const format of ['markdown', 'json', 'html']) {
    const result = run(['analyze', input, '--format', format]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes('synthetic-cli-token'));
    if (format === 'json') assert.equal(JSON.parse(result.stdout).groups[0].count, 2);
  }
  const piped = run(['analyze', '-', '--format', 'json'], text);
  assert.equal(piped.status, 0, piped.stderr);
  assert.equal(JSON.parse(piped.stdout).entries, 4);
  assert.equal(run(['analyze', input, '--fail-on', 'error']).status, 2);
  assert.equal(run(['analyze', '-', '--fail-on', 'error'], 'WARN only').status, 0);
  assert.equal(run(['analyze', '-', '--fail-on', 'warning'], 'WARN only').status, 2);
  const output = join(directory, 'report.html');
  assert.equal(run(['analyze', input, '--format', 'html', '--output', output]).status, 0);
  const saved = readFileSync(output, 'utf8');
  assert.equal(run(['analyze', input, '--output', output]).status, 1);
  assert.equal(readFileSync(output, 'utf8'), saved);
  assert.equal(run(['analyze', input, '--output', input]).status, 1);
  assert.equal(readFileSync(input, 'utf8'), text);
  assert.equal(run(['analyze', directory]).status, 1);
  const invalid = join(directory, 'invalid.log');
  writeFileSync(invalid, Buffer.from([0xff, 0xfe, 0x00]));
  assert.match(run(['analyze', invalid]).stderr, /UTF-8/);
  writeFileSync(invalid, 'x'.repeat(16 * 1024 * 1024 + 1));
  assert.match(run(['analyze', invalid]).stderr, /16 MiB/);
});
for (const args of [
  ['unknown'], ['analyze'], ['analyze', 'missing.log'], ['analyze', '-', '--format', 'xml'],
  ['analyze', '-', '--format', 'json', '--format', 'html'], ['analyze', '-', '--output'],
  ['analyze', '-', '--fail-on', 'info'], ['analyze', '-', '--unknown', 'value'],
]) {
  test(`invalid CLI arguments ${JSON.stringify(args)}`, () => assert.equal(run(args, '').status, 1));
}
test('help/version are available without input', () => {
  assert.equal(run(['--help']).status, 0);
  assert.equal(run(['--version']).stdout, '0.1.0\n');
});

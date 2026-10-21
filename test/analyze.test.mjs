import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze, fingerprint, parseEntries, redact, render } from '../dist/index.js';

test('text timestamps, levels and multiline traces preserve exact source lines', () => {
  const report = analyze('2026-10-22T02:00:00Z INFO started\n2026-10-22T02:00:01Z ERROR ECONNREFUSED 127.0.0.1:5432\n    at connect (app.js:8:2)\n2026-10-22T02:00:02Z ERROR ECONNREFUSED 127.0.0.1:5432\n');
  assert.equal(report.entries, 3);
  assert.equal(report.inputLines, 4);
  assert.equal(report.groups.length, 1);
  assert.equal(report.groups[0].count, 2);
  assert.equal(report.groups[0].firstLine, 2);
  assert.equal(report.groups[0].lastLine, 4);
  assert.match(report.groups[0].sampleStack[0], /at connect/);
  assert.equal(report.groups[0].suggestions[0].code, 'CONNECTION_REFUSED');
});
test('JSON Lines handle string/numeric levels and structured errors', () => {
  const report = analyze([
    JSON.stringify({ level: 40, msg: 'slow', time: 123 }),
    JSON.stringify({ severity: 'CRITICAL', error: { message: 'out of memory', stack: 'frame one\nframe two' } }),
    JSON.stringify({ level: 'info', message: 'okay' }),
  ].join('\n'));
  assert.equal(report.counts.warning, 1);
  assert.equal(report.counts.fatal, 1);
  assert.equal(report.counts.info, 1);
  assert.equal(report.groups[0].level, 'fatal');
  assert.deepEqual(report.groups[0].sampleStack, ['frame one', 'frame two']);
});
test('unknown and malformed JSON lines remain visible in summary', () => {
  const report = analyze('plain text\n{"bad":\n{"other":1}\n');
  assert.equal(report.entries, 3);
  assert.equal(report.unparsedJsonLines, 1);
  assert.equal(report.counts.unknown, 3);
  assert.equal(report.groups.length, 0);
});
test('fingerprints normalize addresses and UUIDs without merging different ports/codes', () => {
  assert.equal(fingerprint('object 0x123 at 123e4567-e89b-12d3-a456-426614174000'), 'object <address> at <uuid>');
  const report = analyze('ERROR object 0x123\nERROR object 0x456\nERROR ECONNREFUSED port 5432\nERROR ECONNREFUSED port 6379');
  assert.equal(report.groups.length, 3);
  assert.equal(report.groups[0].count, 2);
});
test('redacts synthetic assignments, bearer credentials, URL userinfo and encoded query keys', () => {
  const input = 'ERROR password="synthetic password" api_key=synthetic-api-key Authorization: Bearer synthetic-bearer https://username:synthetic-url-key@example.invalid/?%74oken=synthetic-query-key';
  const report = analyze(input);
  assert.ok(report.redactionMatches >= 4);
  for (const format of ['markdown', 'json', 'html']) {
    const output = render(report, format);
    for (const secret of ['synthetic password', 'synthetic-api-key', 'synthetic-bearer', 'synthetic-url-key', 'synthetic-query-key']) assert.ok(!output.includes(secret), secret);
  }
});
test('JSON fields and assignments inside JSON messages are redacted without damaging JSON', () => {
  const result = redact(JSON.stringify({ level: 'error', message: 'login password=synthetic-password failed', metadata: { token: 'synthetic-token' }, stack: 'at password=synthetic-stack' }));
  const parsed = JSON.parse(result.text);
  assert.equal(parsed.metadata.token, '[REDACTED]');
  assert.ok(!result.text.includes('synthetic-'));
  const report = analyze(JSON.stringify({ level: 'error', msg: 'api_key=synthetic-key' }));
  assert.equal(report.counts.error, 1);
  assert.equal(report.unparsedJsonLines, 0);
  assert.ok(!JSON.stringify(report).includes('synthetic-key'));
});
test('multiline private key redaction preserves following source line numbers', () => {
  const input = 'INFO key follows\n-----BEGIN PRIVATE KEY-----\nsynthetic-private-material\n-----END PRIVATE KEY-----\nERROR later\n';
  const report = analyze(input);
  assert.equal(report.inputLines, 5);
  assert.equal(report.groups[0].firstLine, 5);
  assert.ok(!JSON.stringify(report).includes('synthetic-private-material'));
});
test('strips terminal escapes and dangerous HTML is escaped', () => {
  const report = analyze('\x1b[31mERROR\x1b[0m <img src=x onerror=alert(1)>\n');
  assert.equal(report.counts.error, 1);
  const output = render(report, 'html');
  assert.ok(output.includes('&lt;img'));
  assert.ok(!output.includes('<img'));
  assert.ok(!output.includes('<script'));
  assert.ok(output.includes("default-src 'none'"));
});
test('eight diagnostic categories give hypotheses, not automatic fixes', () => {
  const fixtures = [
    ['ECONNREFUSED', 'CONNECTION_REFUSED'], ['EAI_AGAIN', 'DNS_LOOKUP'], ['ETIMEDOUT', 'TIMEOUT'],
    ['EACCES', 'PERMISSION'], ['MODULE_NOT_FOUND', 'MISSING_RESOURCE'], ['ENOMEM', 'MEMORY_LIMIT'],
    ['EADDRINUSE', 'PORT_IN_USE'], ['CERT_HAS_EXPIRED', 'TLS_VALIDATION'],
  ];
  for (const [message, code] of fixtures) {
    const report = analyze(`ERROR ${message}`);
    assert.ok(report.groups[0].suggestions.some(suggestion => suggestion.code === code), message);
  }
});
test('empty input, deterministic output and no safety guarantee', () => {
  const report = analyze('');
  assert.equal(report.entries, 0);
  assert.equal(report.inputLines, 0);
  assert.match(render(report, 'markdown'), /Unknown formats/);
  assert.deepEqual(analyze('WARN notice\nERROR fail'), analyze('WARN notice\nERROR fail'));
  assert.match(report.disclaimer, /incomplete/);
});
test('input limits reject oversized data before report generation', () => {
  assert.throws(() => analyze('x'.repeat(16 * 1024 * 1024 + 1)), /16 MiB/);
  assert.throws(() => parseEntries('x'.repeat(64 * 1024 + 1)), /64 KiB/);
  assert.throws(() => parseEntries('a\n'.repeat(100001)), /100000/);
});

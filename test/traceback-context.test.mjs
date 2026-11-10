import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze, parseEntries, redact, render } from '../dist/index.js';

test('indented Python source stays inside its traceback even when it resembles a log', () => {
  for (const source of [
    '    error = 1 / 0',
    '    warning = values[0]',
    '    {"level":"error","message":"synthetic source context"}',
  ]) {
    const input = `Traceback (most recent call last):\n  File "app.py", line 8, in run\n${source}\nValueError: synthetic failure\nINFO recovered\n`;
    const report = analyze(input);
    assert.equal(report.entries, 2, source);
    assert.equal(report.counts.error, 1, source);
    assert.equal(report.counts.warning, 0, source);
    assert.equal(report.counts.info, 1, source);
    assert.equal(report.groups[0].message, 'ValueError: synthetic failure', source);
    assert.ok(report.groups[0].sampleStack.includes(source.trim()), source);
    assert.equal(report.groups[0].firstLine, 1);
  }
});

test('Python exceptions without a message complete their traceback', () => {
  for (const exception of ['ValueError', 'custom.EmptyFailure', 'StopIteration', 'Warning', 'ErrorFromPlugin']) {
    const input = `Traceback (most recent call last):\n  File "app.py", line 1, in run\n    raise ${exception}\n${exception}\n`;
    const report = analyze(input);
    assert.equal(report.entries, 1, exception);
    assert.equal(report.counts.unknown, 0, exception);
    assert.equal(report.groups[0].message, exception);
    assert.ok(report.groups[0].sampleStack.includes(exception));
  }
});

test('timestamped records end an unfinished traceback even when indented', () => {
  for (const record of [
    '  2026-11-10T08:00:00Z ERROR separate event',
    '  {"time":"2026-11-10T08:00:00Z","level":"error","message":"separate event"}',
  ]) {
    const input = `Traceback (most recent call last):\n  File "app.py", line 1, in run\n    error = 1 / 0\n${record}`;
    const parsed = parseEntries(redact(input).text);
    assert.equal(parsed.entries.length, 2);
    assert.equal(parsed.entries[1].message, 'separate event');
    assert.equal(parsed.entries[1].line, 4);
    assert.equal(parsed.entries[1].timestamp, '2026-11-10T08:00:00Z');
  }
});

test('ordinary status text does not become a message-free exception', () => {
  const input = 'Traceback (most recent call last):\n  File "app.py", line 1, in run\nready';
  const parsed = parseEntries(input);
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[1].message, 'ready');
});

test('chained empty-message exceptions preserve one incident and the next event boundary', () => {
  const input = 'Traceback (most recent call last):\n  File "app.py", line 1, in run\nValueError\n\nDuring handling of the above exception, another exception occurred:\n\nTraceback (most recent call last):\n  File "app.py", line 4, in run\nRuntimeError\nERROR separate failure\n';
  const parsed = parseEntries(redact(input).text);
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[0].message, 'RuntimeError');
  assert.equal(parsed.entries[1].message, 'separate failure');
  assert.equal(parsed.entries[1].line, 10);
});

test('JSON-looking traceback source remains redacted in every report format', () => {
  const input = 'Traceback (most recent call last):\n  File "app.py", line 2, in run\n    {"level":"error","api_key":"synthetic-traceback-key"}\nValueError: invalid config\n';
  const report = analyze(input);
  assert.equal(report.entries, 1);
  assert.equal(report.redactionMatches, 1);
  assert.equal(report.groups[0].message, 'ValueError: invalid config');
  assert.ok(report.groups[0].sampleStack.some(line => line.includes('[REDACTED]')));
  for (const format of ['markdown', 'json', 'html']) {
    assert.ok(!render(report, format).includes('synthetic-traceback-key'));
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze, render } from '../dist/index.js';

test('standalone Node exceptions become errors with their stack frames', () => {
  const report = analyze('TypeError: cannot read property\n    at run (app.js:8:4)\n    at main (app.js:14:2)\n');
  assert.equal(report.counts.error, 1);
  assert.equal(report.groups.length, 1);
  assert.equal(report.groups[0].sampleStack.length, 2);
  assert.equal(report.groups[0].firstLine, 1);
});
test('standalone Python traceback remains one incident including source context', () => {
  const report = analyze('Traceback (most recent call last):\n  File "main.py", line 8, in <module>\n    read_file()\nFileNotFoundError: No such file or directory\n');
  assert.equal(report.entries, 1);
  assert.equal(report.counts.error, 1);
  assert.equal(report.groups[0].message, 'FileNotFoundError: No such file or directory');
  assert.ok(report.groups[0].sampleStack.includes('read_file()'));
  assert.ok(report.groups[0].suggestions.some(s => s.code === 'MISSING_RESOURCE'));
});
test('Python logger comma timestamps and explicit error headers keep one entry', () => {
  const report = analyze('2026-10-31 10:20:30,123 ERROR Worker failed\nTraceback (most recent call last):\n  File "worker.py", line 1, in run\n    connect()\nConnectionError: connection refused\n2026-10-31 10:20:31,456 INFO retry scheduled\n');
  assert.equal(report.entries, 2);
  assert.equal(report.counts.error, 1);
  assert.equal(report.counts.info, 1);
  assert.equal(report.groups[0].message, 'Worker failed');
  assert.ok(report.groups[0].suggestions.some(s => s.code === 'CONNECTION_REFUSED'));
});
test('chained Python tracebacks stay together and use the final exception title', () => {
  const report = analyze('Traceback (most recent call last):\n  File "app.py", line 1, in run\nValueError: invalid\n\nDuring handling of the above exception, another exception occurred:\n\nTraceback (most recent call last):\n  File "app.py", line 4, in run\nRuntimeError: failed\n');
  assert.equal(report.entries, 1);
  assert.equal(report.groups[0].message, 'RuntimeError: failed');
  assert.equal(report.groups[0].firstLine, 1);
});
test('adjacent independent tracebacks remain separate occurrences', () => {
  const trace = 'Traceback (most recent call last):\n  File "app.py", line 1, in run\nValueError: invalid\n';
  const report = analyze(trace + trace);
  assert.equal(report.entries, 2);
  assert.equal(report.groups[0].count, 2);
});
test('ordinary colon text is not inferred to be an exception', () => {
  assert.equal(analyze('Notice: service started\nINFO healthy').counts.error, 0);
});
test('HTTP Basic credentials and values containing a redaction marker are omitted', () => {
  const credential = 'c3ludGhldGljOm5vdC1hLXJlYWwta2V5';
  const report = analyze(`ERROR Authorization: Basic ${credential}\nERROR password="synthetic-secret[REDACTED]suffix"\n`);
  for (const format of ['markdown', 'json', 'html']) {
    const output = render(report, format);
    assert.ok(!output.includes(credential));
    assert.ok(!output.includes('synthetic-secret'));
  }
});

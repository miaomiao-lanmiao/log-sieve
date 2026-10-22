import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze, redact, render } from '../dist/index.js';

const fixtures = [
  'ERROR api\x1b[31m_key\x1b[0m=synthetic-color-key',
  'ERROR Bearer \x1b[0msynthetic-color-bearer',
  JSON.stringify({ level: 'error', message: 'Bearer \x1b[0msynthetic-json-bearer' }),
  JSON.stringify({ level: 'error', message: 'failed', metadata: { 'api\u202a_key': 'synthetic-json-key' } }),
];
for (const [index, input] of fixtures.entries()) {
  test(`credential matching follows terminal-control normalization (${index + 1})`, () => {
    const clean = redact(input);
    assert.doesNotMatch(clean.text, /synthetic-(?:color|json)-/);
    const report = analyze(input);
    assert.equal(report.counts.error, 1);
    for (const format of ['markdown', 'json', 'html']) {
      assert.doesNotMatch(render(report, format), /synthetic-(?:color|json)-/);
    }
  });
}
test('colored private-key markers are redacted while retaining source line references', () => {
  const report = analyze('INFO start\n-----BEGIN \x1b[31mPRIVATE KEY-----\nsynthetic-colored-private-material\n-----END PRIVATE KEY-----\nERROR later\n');
  assert.equal(report.redactionMatches, 1);
  assert.equal(report.groups[0].firstLine, 5);
  assert.doesNotMatch(JSON.stringify(report), /synthetic-colored-private-material/);
});

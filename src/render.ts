import { displayText, type Report } from './analyze.js';

const html = (value: string): string => displayText(value).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const md = (value: string): string => html(value).replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1');

export function render(report: Report, format: 'markdown' | 'json' | 'html'): string {
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  const summary = `${report.entries} entries · ${report.groups.length} warning/error groups · ${report.redactionMatches} redaction pattern matches`;
  if (format === 'html') {
    const groups = report.groups.map(group => `<article><header><span class="level ${group.level}">${html(group.level)}</span><span>×${group.count} · lines ${group.firstLine}–${group.lastLine}</span></header><h2>${html(group.message)}</h2>${group.sampleStack.length ? `<pre>${group.sampleStack.map(html).join('\n')}</pre>` : ''}${group.suggestions.map(suggestion => `<section><h3>${html(suggestion.code)}</h3><p>${html(suggestion.explanation)}</p><ul>${suggestion.checks.map(check => `<li>${html(check)}</li>`).join('')}</ul></section>`).join('')}</article>`).join('\n');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Log Sieve report</title><style>
:root{color-scheme:light;font:16px/1.6 system-ui,sans-serif;color:#172b35;background:#f1f5f2}body{max-width:960px;margin:0 auto;padding:48px 24px}h1{font-size:clamp(2rem,6vw,3.4rem);margin:0;color:#123d32;letter-spacing:-.04em}.eyebrow{font-size:.8rem;font-weight:700;letter-spacing:.14em;color:#49695c}.summary{font-size:1.1rem}.note{padding:16px 20px;border-left:4px solid #a6ba6e;background:#e6eddc}article{background:white;border:1px solid #dbe3dc;border-radius:16px;padding:24px;margin:24px 0;box-shadow:0 4px 24px #18352808}header{display:flex;gap:14px;align-items:center;flex-wrap:wrap;color:#53645c;font-size:.85rem}.level{border-radius:5px;padding:2px 9px;text-transform:uppercase;font-weight:700;background:#fff0cd;color:#785612}.error,.fatal{background:#fce5df;color:#9e3620}h2{font-size:1.15rem;overflow-wrap:anywhere}h3{font-size:.8rem;letter-spacing:.05em;color:#356754}pre{font-size:.8rem;white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f4;padding:16px;border-radius:8px}li{margin:.4rem 0}footer{font-size:.8rem;color:#66766d}p{overflow-wrap:anywhere}
</style></head><body><p class="eyebrow">OFFLINE LOG REVIEW · LOG SIEVE ${html(report.toolVersion)}</p><h1>Less noise. Clearer next steps.</h1><p class="summary">${summary}</p><p class="note">${html(report.disclaimer)}</p><p>Fatal: ${report.counts.fatal} · Error: ${report.counts.error} · Warning: ${report.counts.warning} · Unparsed JSON lines: ${report.unparsedJsonLines}</p>${groups || '<article><h2>No warning/error groups recognized.</h2><p>Unknown log formats may require manual review.</p></article>'}<footer>Generated locally. No scripts, remote assets or telemetry.</footer></body></html>\n`;
  }
  const lines = ['# Log Sieve report', '', summary, '', report.disclaimer, '',
    `Fatal: ${report.counts.fatal} · Error: ${report.counts.error} · Warning: ${report.counts.warning} · Unparsed JSON lines: ${report.unparsedJsonLines}`, ''];
  if (!report.groups.length) lines.push('No warning/error groups recognized. Unknown formats may require manual review.', '');
  for (const group of report.groups) {
    lines.push(`## ${group.level.toUpperCase()} ×${group.count}: ${md(group.message)}`, '', `Lines ${group.firstLine}–${group.lastLine}`, '');
    if (group.sampleStack.length) lines.push('Stack sample:', '', ...group.sampleStack.map(line => `    ${displayText(line)}`), '');
    for (const suggestion of group.suggestions) {
      lines.push(`### ${suggestion.code}`, '', suggestion.explanation, '', ...suggestion.checks.map(check => `- ${check}`), '');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

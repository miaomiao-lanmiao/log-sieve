export interface Redaction { text: string; matches: number }
const sensitiveName = /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|client[_-]?secret|authorization|secret[_-]?access[_-]?key|access[_-]?key(?:[_-]?id)?)$/i;

function redactPlain(text: string): Redaction {
  let matches = 0;
  const replace = (pattern: RegExp, transform: (...groups: string[]) => string): void => {
    text = text.replace(pattern, (...groups: string[]) => { matches++; return transform(...groups); });
  };
  replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    block => `[PRIVATE KEY REDACTED]${'\n'.repeat((block.match(/\n/g) ?? []).length)}`);
  replace(/(\bBearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, (_all, prefix) => `${prefix}[REDACTED]`);
  replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, (_all, protocol) => `${protocol}[REDACTED]@`);
  text = text.replace(/([?&])([^=&#\s"'<>]+)=([^&#\s"'<>]*)/g, (all: string, delimiter: string, key: string) => {
    let decoded: string;
    try { decoded = decodeURIComponent(key.replace(/\+/g, ' ')); } catch { return all; }
    if (!sensitiveName.test(decoded)) return all;
    matches++;
    return `${delimiter}${key}=[REDACTED]`;
  });
  text = text.replace(/(["']?((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|client[_-]?secret|authorization|secret[_-]?access[_-]?key|access[_-]?key(?:[_-]?id)?))["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'[^']*'|[^\s,;}&#"']+)/gi,
    (all: string, prefix: string, key: string, value: string) => {
      if (!sensitiveName.test(key) || value.includes('[REDACTED]')) return all;
      matches++;
      return `${prefix}"[REDACTED]"`;
    });
  replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})\b/g, () => '[REDACTED]');
  return { text, matches };
}

export function redact(input: string): Redaction {
  let matches = 0;
  // Preserve line numbering even when a multiline private key is removed.
  input = input.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, block => {
    matches++;
    return `[PRIVATE KEY REDACTED]${'\n'.repeat((block.match(/\n/g) ?? []).length)}`;
  });
  function visit(value: unknown): unknown {
    if (typeof value === 'string') {
      const result = redactPlain(value); matches += result.matches; return result.text;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        if (sensitiveName.test(key) && child !== '' && child !== null) {
          matches++; return [key, '[REDACTED]'];
        }
        return [key, visit(child)];
      }));
    }
    return value;
  }
  const text = input.split('\n').map(line => {
    if (line.trim().startsWith('{')) {
      try { return JSON.stringify(visit(JSON.parse(line) as unknown)); }
      catch { /* Malformed JSON is analyzed as text, with the same redaction pass. */ }
    }
    const result = redactPlain(line); matches += result.matches; return result.text;
  }).join('\n');
  return { text, matches };
}

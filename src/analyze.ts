import { createHash } from 'node:crypto';
import { redact } from './redact.js';

export type Level = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'unknown';
export interface Entry { line: number; level: Level; timestamp: string | null; message: string; stack: string[] }
export interface Suggestion { code: string; explanation: string; checks: string[] }
export interface Group {
  id: string; level: Level; message: string; count: number;
  firstLine: number; lastLine: number; sampleStack: string[]; suggestions: Suggestion[];
}
export interface Report {
  schemaVersion: 1; toolVersion: '0.1.0'; inputLines: number; entries: number;
  unparsedJsonLines: number; redactionMatches: number;
  counts: Record<Level, number>; groups: Group[]; disclaimer: string;
}

export function displayText(value: string): string {
  return value.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').trim();
}

function level(value: unknown): Level {
  if (typeof value === 'number') value = ({ 10: 'trace', 20: 'debug', 30: 'info', 40: 'warning', 50: 'error', 60: 'fatal' } as Record<number, string>)[value];
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'warn') return 'warning';
  if (normalized === 'critical') return 'fatal';
  return ['trace', 'debug', 'info', 'warning', 'error', 'fatal'].includes(normalized) ? normalized as Level : 'unknown';
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function inputLines(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines.length > 100000) throw new Error('Input exceeds the 100000-line limit.');
  for (const line of lines) if (Buffer.byteLength(line) > 64 * 1024) throw new Error('A line exceeds the 64 KiB limit.');
  return lines;
}

export function parseEntries(text: string): { entries: Entry[]; inputLines: number; unparsedJsonLines: number } {
  const lines = inputLines(text);
  const entries: Entry[] = [];
  let unparsedJsonLines = 0;
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    if (!raw.trim()) continue;
    const clean = displayText(raw);
    let message = clean;
    let timestamp: string | null = null;
    let severity: Level = 'unknown';
    let json = false;
    let stack: string[] = [];
    if (clean.startsWith('{')) {
      try {
        const value: unknown = JSON.parse(clean);
        if (object(value)) {
          json = true;
          severity = level(value.level ?? value.severity);
          const error = object(value.error) ? value.error : object(value.err) ? value.err : {};
          const body = value.message ?? value.msg ?? error.message;
          message = typeof body === 'string' ? displayText(body) : '(JSON entry without a string message)';
          const time = value.timestamp ?? value.time ?? value.ts;
          timestamp = typeof time === 'string' || typeof time === 'number' ? displayText(String(time)) : null;
          const trace = value.stack ?? error.stack;
          if (typeof trace === 'string') stack = trace.split(/\r?\n/).map(displayText).filter(Boolean);
        } else unparsedJsonLines++;
      } catch { unparsedJsonLines++; }
    }
    if (!json) {
      const prefix = /^(?:\[?(\d{4}-\d{2}-\d{2}[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*)?(?:\[?(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\]?\s*[:|-]?\s*)?(.*)$/i.exec(clean)!;
      timestamp = prefix[1] ?? null;
      severity = level(prefix[2]);
      message = prefix[3] ?? clean;
      const previous = entries.at(-1);
      if (previous && !timestamp && severity === 'unknown' &&
          (/^\s+(?:at\s|File\s|\^|\.\.\.)/.test(raw) || /^(?:Traceback |Caused by:|[\w.]+(?:Error|Exception):)/.test(clean))) {
        previous.stack.push(clean);
        continue;
      }
    }
    entries.push({ line: index + 1, level: severity, timestamp, message, stack });
  }
  return { entries, inputLines: lines.length, unparsedJsonLines };
}

const rules: Array<{ pattern: RegExp } & Suggestion> = [
  { code: 'CONNECTION_REFUSED', pattern: /ECONNREFUSED|connection refused/i, explanation: 'The destination did not accept a connection.', checks: ['Confirm the service is running and listening on the configured host and port.', 'Check local service/container routing before retrying.'] },
  { code: 'DNS_LOOKUP', pattern: /ENOTFOUND|EAI_AGAIN|name resolution|DNS.*(?:fail|error)/i, explanation: 'A hostname lookup may have failed.', checks: ['Verify the configured hostname and DNS resolver.', 'Check proxy and network configuration in the failing environment.'] },
  { code: 'TIMEOUT', pattern: /ETIMEDOUT|timed?\s*out|timeout/i, explanation: 'An operation exceeded its time budget.', checks: ['Inspect upstream latency and connection availability.', 'Review retry limits and measured timeout requirements.'] },
  { code: 'PERMISSION', pattern: /EACCES|EPERM|permission denied/i, explanation: 'A requested operation may lack permission.', checks: ['Check the exact file/resource owner and required access.', 'Grant only the necessary permission; avoid broad elevated execution.'] },
  { code: 'MISSING_RESOURCE', pattern: /ENOENT|MODULE_NOT_FOUND|Cannot find module|no such file/i, explanation: 'A file, module or path may be missing.', checks: ['Check the working directory and configured path.', 'Verify that required build/install steps completed in the same environment.'] },
  { code: 'MEMORY_LIMIT', pattern: /out of memory|heap.*limit|ENOMEM|OOMKilled/i, explanation: 'A process may have reached a memory limit.', checks: ['Inspect memory usage and container/process limits.', 'Look for unbounded input, retained objects or workload spikes.'] },
  { code: 'PORT_IN_USE', pattern: /EADDRINUSE|address already in use/i, explanation: 'Another listener may already use the selected address.', checks: ['Identify the expected listener and configured port.', 'Stop only a confirmed stale instance, or choose an unused port.'] },
  { code: 'TLS_VALIDATION', pattern: /CERT_|certificate.*(?:invalid|expired|verify|fail)|unable to verify.*certificate|self.signed certificate/i, explanation: 'TLS certificate validation may have failed.', checks: ['Verify the hostname, system clock and certificate chain.', 'Configure the intended trusted CA; keep TLS verification enabled.'] },
];

export function fingerprint(message: string): string {
  return message.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<address>').replace(/\s+/g, ' ').trim();
}

export function analyze(input: string): Report {
  if (Buffer.byteLength(input) > 16 * 1024 * 1024) throw new Error('Input exceeds the 16 MiB limit.');
  inputLines(input);
  const sanitized = redact(input);
  const parsed = parseEntries(sanitized.text);
  const counts: Record<Level, number> = { trace: 0, debug: 0, info: 0, warning: 0, error: 0, fatal: 0, unknown: 0 };
  const groups = new Map<string, Group>();
  for (const entry of parsed.entries) {
    counts[entry.level]++;
    if (!['warning', 'error', 'fatal'].includes(entry.level)) continue;
    const normalized = fingerprint(entry.message);
    const key = `${entry.level}\0${normalized}`;
    const found = groups.get(key);
    if (found) { found.count++; found.lastLine = entry.line; continue; }
    const content = `${entry.message}\n${entry.stack.join('\n')}`;
    groups.set(key, { id: createHash('sha256').update(key).digest('hex').slice(0, 16),
      level: entry.level, message: entry.message, count: 1, firstLine: entry.line, lastLine: entry.line,
      sampleStack: entry.stack.slice(0, 30), suggestions: rules.filter(rule => rule.pattern.test(content))
        .map(({ code, explanation, checks }) => ({ code, explanation, checks: [...checks] })) });
  }
  const rank = { fatal: 0, error: 1, warning: 2, unknown: 3, info: 4, debug: 5, trace: 6 };
  return { schemaVersion: 1, toolVersion: '0.1.0', inputLines: parsed.inputLines,
    entries: parsed.entries.length, unparsedJsonLines: parsed.unparsedJsonLines,
    redactionMatches: sanitized.matches, counts,
    groups: [...groups.values()].sort((a, b) => rank[a.level] - rank[b.level] || b.count - a.count || a.firstLine - b.firstLine),
    disclaimer: 'Suggestions are hypotheses for human review. Pattern-based redaction is incomplete; unrecognized credentials, personal data, paths and hosts may remain. Review reports before sharing.',
  };
}

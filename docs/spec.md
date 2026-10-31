# Log Sieve specification

Version: 0.1.0, 2026-10-22.

Maintenance v0.1.1 (2026-10-23): normalize terminal controls before credential
matching, including decoded JSON values/keys; retain original input limits and
line references. Tool-version metadata is shared across CLI and report formats.

Feature v0.2.0 (2026-10-31): recognize common standalone Node exception headers,
Python tracebacks/chains and comma-millisecond log timestamps. Redact HTTP Basic
credentials and exact-placeholder matches without skipping larger secret values.

## Purpose

Developers need to turn noisy application logs into a short, reviewable incident
summary without uploading them. Log Sieve is an offline TypeScript CLI with zero
runtime dependencies. It groups repeated warnings/errors, preserves stack traces,
redacts common credential formats, and suggests bounded troubleshooting checks.

## Interface

`logsieve analyze FILE [--format markdown|json|html] [--output NEW_FILE]
[--fail-on warning|error]`; use `-` as FILE to read stdin. `--help` and `--version`
do not require input. Success is 0, invalid input/I/O is 1, requested threshold
crossed is 2. Output files are exclusively created and never overwritten.

## Scope

- Plain text and JSON Lines (message/msg, level/severity, timestamp/time/ts).
- Numeric Pino levels, ISO timestamps, stack trace continuation lines, and a
  stable fingerprint that normalizes UUIDs and memory addresses while retaining
  useful error codes and port numbers.
- Redact common password/token/API-key assignments, bearer authorization,
  URL userinfo and credential query parameters, and private key blocks **before**
  grouping or reporting. Counts describe pattern matches, not proven secrets.
- Static suggestions for connection refusal, DNS errors, timeouts, permission
  errors, missing files/modules, memory limits, port conflicts, and TLS validation.
  Suggestions are hypotheses for human review, never confirmed root causes.
- Deterministic Markdown/JSON and standalone HTML with no JavaScript or remote
  assets. Reports may retain unrecognized secrets, personal data, hosts and paths;
  this is not comprehensive anonymization.
- Explicit regular-file/stdin input only; UTF-8, 16 MiB per input, 64 KiB per line,
  100000 lines. No tailing, recursive discovery, compressed logs, network access,
  subprocesses, AI service, package-script execution, or automated fixes.

## Acceptance criteria

1. Unit tests cover JSON/text levels, timestamps, multiline traces, exact counts,
   stable grouping, malformed JSON, and deterministic ordering.
2. Synthetic credentials never appear in Markdown/JSON/HTML output; HTML escapes
   active content and blocks scripts/external resources with CSP. Tests state
   redaction limits and distinguish pattern matching from a safety guarantee.
3. A real CLI smoke test covers files with spaces, stdin, all formats, optional
   threshold exit 2, invalid encodings/oversized inputs, and no-overwrite behavior.
4. `npm test`, `npm run build`, and offline tarball installation pass locally;
   GitHub Actions runs these checks on Linux, Windows, and macOS with Node 22+.
5. The repository has bilingual quickstart, examples, MIT license, contribution
   and review instructions, issue templates, CI, a spec-first history, version
   tag, public GitHub repository and release draft after verified CI.

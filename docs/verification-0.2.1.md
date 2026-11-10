# v0.2.1 verification

Date: 2026-11-10 (Asia/Shanghai). Local platform: Windows, Node.js v26.13.0.

## Reproduced failures

Three new regression tests failed against v0.2.0 before the fixes:

- An indented Python source line starting with `error` split a single traceback
  into extra entries (four total entries instead of a traceback plus the following
  INFO event). JSON-looking source had the same context problem.
- A traceback ending with a message-free `ValueError` produced two entries and
  kept the generic traceback title instead of the exception name.
- Chained message-free exceptions produced six entries instead of one incident
  plus the following explicit error event.

The fix gives unfinished traceback source context priority over text/JSON log
classification, preserves JSON-line indentation through redaction, and recognizes
message-free exception names within a traceback. A fourth regression checks that
credentials in JSON-looking source remain redacted in Markdown, JSON and HTML.
An additional regression failed against the first maintenance commit. It confirms
that a timestamped record after a truncated traceback stays separate in text and
JSON formats, including when the record is indented. Bare class names such as
`Warning` and `ErrorFromPlugin` and ordinary status words are also covered.

## Local gates

- Clean dependency install: `npm ci --ignore-scripts` passed.
- `npm test`: 40 passed, zero failed, including all previous standalone-trace tests.
- `npm run build`: passed with strict TypeScript.
- `npm run check:package`: passed offline tarball installation and the installed
  command's version/parsing/redaction checks.
- `git diff --check`: passed.
- Existing headless Edge HTML QA passed: three example groups, no active content,
  external requests or fixture credential values, and no overflow at 390px.
  The refreshed 0.2.1 desktop screenshot was visually inspected.

Hosted Linux/Windows/macOS Node 22 CI remains the release gate. This local record
does not establish a remote result. Stack recognition and credential redaction
remain heuristics; incomplete or unusual trace formats can need manual review.

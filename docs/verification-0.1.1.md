# v0.1.1 verification

Date: 2026-10-23 (Asia/Shanghai). Local platform: Windows, Node.js v24.18.0.

- Five synthetic terminal-control redaction cases failed before the repair.
- All 26 tests passed after the repair, including text and JSON credentials,
  direction controls in field names and styled private-key markers.
- Strict build and offline packed-command installation passed.
- The refreshed v0.1.1 HTML example passed desktop/mobile Edge checks with no
  external requests, active content, fixture credential values or mobile overflow.
- Version metadata is shared by CLI, JSON and HTML. JSON schema remains 1.

Hosted Linux/Windows/macOS CI is required before the release draft. These are
bounded tests; pattern-based redaction remains incomplete.

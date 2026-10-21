# Verification record

Local environment: 2026-10-22 (Asia/Shanghai), Windows, Node.js v24.18.0.

- 21 tests passed, including real CLI file/stdin/error/output-protection tests.
- Strict TypeScript build passed.
- Offline packed-package installation and actual installed command passed.
- Synthetic credentials were absent from Markdown, JSON and HTML fixture output.
- Headless Edge rendered the HTML example with three groups, no active/external
  content, no page errors and no horizontal overflow at 390px.
- HTML screenshots were visually inspected. Screenshots and local outputs remain
  ignored under `reports/`.

GitHub CI is configured for Linux, Windows and macOS on Node.js 22. Hosted results
must be checked on the Actions page before creating the release draft. These
checks are bounded evidence, not a guarantee of complete redaction or diagnosis.

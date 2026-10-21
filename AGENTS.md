# Working on Log Sieve

Read `docs/spec.md` before behavioral changes. Keep runtime npm dependencies at
zero. Use strict TypeScript and Node built-ins. No runtime network/subprocesses,
directory discovery, source-log modification, existing-file replacement, or
automatic fixes. Input limits and safe output are part of the public behavior.

All credentials in tests must be synthetic. Redact before grouping, preserve JSON
validity and source line numbers, and never imply full anonymization or confirmed
causality. HTML must contain no scripts or external assets. Preserve JSON schema
compatibility and deterministic ordering.

For bugs, add a focused regression. Before committing, run `npm test`,
`npm run build`, `npm run check:package`, and `git diff --check`. Confirm the
README quickstart from a clean install. Do not commit user logs, secrets,
node_modules, build outputs, or local reports.

The current user requested a new project and public GitHub work. Create a public
repository only for this project's source, push focused commits, wait for hosted
CI, and keep the initial release as a draft. Do not publish to npm. Future release
work requires an actual release request. Bump package/CLI/test versions together,
write versioned notes, and never move an already-pushed tag.

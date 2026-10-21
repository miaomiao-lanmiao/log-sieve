# Contributing

Use Node.js 22+ and the README development commands. Create a focused branch and
use synthetic logs when adding parser/redaction/diagnostic tests. Preserve the
original failing case and describe any grouping or JSON-schema change.

Bug reports should include OS/Node versions, the exact command, expected/actual
result and a **small sanitized reproduction**. Never attach private logs or keys.
Feature requests should describe the workflow and example desired output.

New diagnostic rules must explain uncertainty and safe next checks. New redaction
patterns need positive and negative examples; report limits honestly. Runtime
network calls, telemetry and automatic remediation are outside the project scope.

Contributions use MIT. 中文反馈欢迎。

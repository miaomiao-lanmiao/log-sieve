# Security policy

The latest 0.1.x release receives fixes. Use private GitHub vulnerability reporting
when available. If it is unavailable, request a private contact channel without
posting secrets or weaponized reproductions. Initial response target: 7 days.

This CLI does not execute log content or contact services. Pattern-based redaction
is incomplete; personal information and unknown credential formats may remain.
Review reports before sharing. No findings or diagnostic suggestions establish
security or causality. Trust your installed Node.js and local filesystem.

Input/output limits, exclusive file creation, control stripping and HTML/Markdown
escaping reduce specific risks. They are not a sandbox for malicious runtimes or
a guarantee against all harmful inputs.

# Log Sieve report

5 entries · 3 warning/error groups · 3 redaction pattern matches

Suggestions are hypotheses for human review. Pattern-based redaction is incomplete; unrecognized credentials, personal data, paths and hosts may remain. Review reports before sharing.

Fatal: 0 · Error: 3 · Warning: 1 · Unparsed JSON lines: 0

## ERROR ×2: ECONNREFUSED 127\.0\.0\.1:5432 token=&quot;\[REDACTED\]&quot;

Lines 2–4

Stack sample:

    at connect (database.js:18:4)

### CONNECTION_REFUSED

The destination did not accept a connection.

- Confirm the service is running and listening on the configured host and port.
- Check local service/container routing before retrying.

## ERROR ×1: EACCES opening /var/app/cache

Lines 6–6

### PERMISSION

A requested operation may lack permission.

- Check the exact file/resource owner and required access.
- Grant only the necessary permission; avoid broad elevated execution.

## WARNING ×1: upstream timeout after 5000ms

Lines 5–5

### TIMEOUT

An operation exceeded its time budget.

- Inspect upstream latency and connection availability.
- Review retry limits and measured timeout requirements.

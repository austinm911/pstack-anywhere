# Evidence packaging repair

A fresh clone of published port `1f5175d30b1e174ca2847db985c9379d2435a33f` failed validation with 29 ledger errors before importing any update. `.gitignore` excluded every `.log` file, including required and cited evidence. Thirty records depended on missing logs. One was already superseded, so the checker reported 29 errors.

The original log bytes are unavailable in the published Git tree. Their records are preserved verbatim in `evidence/withdrawn/2026-10-13-missing-logs.yaml`, outside the active registry. The remaining run directories are unchanged. No evidence was fabricated and no validation requirement was relaxed.

The active registry retains 23 records. Rendered verification now reflects only available evidence. Evidence logs are exempt from the general ignore rule, and `test/evidence-packaging.test.mjs` checks the exemption through Git itself. Ordinary debug logs remain ignored.

The repaired baseline passes portability lint, 37 tests with 259 assertions, upstream source verification, and whitespace checks. Previously claimed runtime coverage needs original log recovery or new conformance runs before it can be restored.

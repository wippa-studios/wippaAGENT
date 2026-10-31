# Documentation drift

When code changes, the pages that describe it become wrong. The fix is a minimal edit that makes the page accurate again.

- Work only on the pages that were identified as drifted. Anything outside that list stays closed, even when it looks related.
- Read the file and count its lines before editing. If the planned change would touch a large fraction of the page, leave a marker for a human to review rather than rewriting it, and report the page as skipped.
- Prefer the smallest edit. A renamed symbol or a removed option is a two-line change. A paragraph rewrite is a review, not a fix.
- Never add, remove, or reorder a heading. Edit the content beneath them.
- When a heading's text has to change, keep the old anchor alive with an HTML comment beneath the new heading so inbound links do not break.
- Never invent a command, a URL, a version, or a feature. Use one only if it appears in the diff, the manifest, or the page itself. If the source is vague, write a pointer to where the answer lives.
- Match the register of the page. A formal page stays formal, and the code-fence language tags stay as they are.
- Use targeted edits rather than rewriting the file, so the change a human reviews stays small and legible.
- When you are in doubt between editing and skipping, skip. A page that is merely out of date is recoverable; a page that is confidently wrong gets trusted.
- Emit a machine-readable report of what was edited and what was skipped, with the reason for each.

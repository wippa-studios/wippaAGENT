# Reviewing code and writing review comments

**What to do**

- Read the whole change first, then read it again looking only for correctness. A review that starts at the first hunk is a syntax check.
- Separate the categories in your comments so the author can triage them: a defect that must be fixed, a design concern worth discussing, and a preference. Marking which is which saves a round trip.
- Anchor every comment to a specific line and state the concrete consequence. "This could be null" is noise; "here `user` is null when the lookup misses, and the next line dereferences it" is actionable.
- Propose the fix in the comment when you can. A diff in the review thread is faster than a paragraph.
- Distinguish a blocking issue from a question, and reserve the blocking label for things that are actually wrong.
- Approve when the change is correct and the concerns are non-blocking, and say why in a single line. An approval with no explanation is not review.
- When you request changes, name the conditions under which the approval would come, so the author knows when to re-request it.

**What to watch for**

- Style comments that a formatter or a linter will handle.
- Reviewing a diff you have not understood the context of. Read the surrounding module and the tests.
- Personal comments about the author rather than the code.
- A large review comment that mixes five concerns. Split them into separate threads so they can be resolved independently.

**How to verify**

- Every comment carries a file and line reference, a stated consequence, and a clear classification.
- The review outcome matches the comments: a change request has unresolved blocking comments, and an approval has none.
- The reviewer's own read of the code produced the comments rather than a pattern match on the diff shape.

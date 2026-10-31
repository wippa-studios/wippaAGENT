# Working in an existing codebase

- Read the module you are about to change, its callers, and its tests, before you write a line.
- Find the convention, not the exception. If there is one legacy-shaped handler in a file of modern ones, do not copy it.
- Keep the public surface stable. If a signature must change, change the implementation behind it first, then the signature, then the callers.
- Split the change into reviewable pieces when it spans layers. Schema, server, and client in one commit is hard to review and hard to revert.
- Update the callers when you change a type. A broken build is a worse outcome than a slightly larger diff.
- Look for the existing extension point before you add a new one. Most of the cost of a change is the third parallel mechanism it introduces.
- Note the behaviour you are relying on when you discover it by reading. A comment that says why the invariant holds is worth more than the invariant itself.
- If you find unrelated problems, report them separately. Do not fix them inside the feature commit.

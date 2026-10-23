# Contributing to wippaAGENT

## What a contribution looks like

Four kinds of change are welcome.

- **A subagent.** A new specialist under an existing category, or a new category when the work genuinely does not fit one of the current ten.
- **A playbook improvement.** A clearer remit, better routing rules, sharper acceptance criteria, or a workflow that removes a step the agent kept getting wrong.
- **A tool.** A change to the `wippa_subagent_*` plugin in `tools/` or to the `wippa-subagent-search` skill in `skills/`.
- **A bug fix.** Wrong routing, a broken frontmatter field, a tool that returns the wrong thing, an installer that copies the wrong path.

## Adding a subagent

1. Pick the category. The subagent belongs in the `categories/NN-slug/` directory that owns the work, using the same numeric prefix and slug style as the existing ones.
2. Add one file. The file name is the agent id, so `categories/04-quality-security/quality-auditor.md` gives the id `quality-auditor`. The installer flattens the category directory, which means the id is the file name and nothing else.
3. Use the shape every definition starts from — the agent's remit decides whether the rules go further:

   ```yaml
   ---
   description: One sentence on what this agent owns and when to route to it.
   mode: subagent
   color: "#10b981"
   permissions:
     - action: shell
       resource: "rm -rf *"
       effect: deny
     - action: shell
       resource: "sudo *"
       effect: deny
   ---
   ```

   The `description` is the routing surface. It is read on every delegation, so it must say what the agent does and when it is the right one, not what the agent is.

4. Keep the `## Attribution` block byte-identical to the one in every other agent file. Do not reword it, reformat it, add to it, or drop it.
5. Keep the body structure that the other agents use: a role statement, the scope the agent covers, the definition of done, the working rules, then the attribution block.

## House style

- Plain technical English. Short sentences. No marketing language.
- No emoji. No exclamation marks.
- Honest metrics only. Never quote a latency, a coverage percentage, a throughput or a count that you did not read from a tool or a file.
- Never claim a test passed unless you saw it pass. If you could not run it, say exactly that instead of implying it works.
- No file in this repository may name any other AI product, vendor, or upstream project. The set stands on its own.
- No file may promise behaviour the code does not have. If a rule cannot be enforced by the file itself, it does not go in the file.

## Pull requests

A pull request should say which category it touches and why that category is the right home for the change. Include what you ran, what it returned, and what you did not check. A pull request that changes the roster should also update the agent table in `README.md` so the two stay in step.

## Licence

By contributing you agree that your contribution is licensed under the MIT Licence of this project.

# Repository readme and root documentation

The readme is the first thing a person sees and the thing they judge the project by. It must be true.

- Scan the repository exhaustively before you write a line. Read the manifest, the scripts, the type definitions, the tests, the entry points, and the exported surface. The readme is a description of the code that exists, not of the code you assume exists.
- Take the examples verbatim from the repository. A copied command from the script definition is correct by construction.
- Capture the actual help output of the command line tool rather than paraphrasing it.
- Never invent an install command, a URL, a version number, a configuration key, an environment variable, or a feature. If the repository does not tell you, look for it in the source, and if it is genuinely absent, say the setup is not documented rather than guessing.
- Flag the gaps you find. A missing setup step is a finding for the project, not a licence to invent one.
- Lead with what the project is, who it is for, and what it does. Three sentences, no preamble.
- List the prerequisites with the versions, the installation with the real command, and a minimal working example that the reader can copy and run.
- Include the configuration as a table of key, meaning, default, and whether it is required, taken from the source.
- Include the commands for build, test, and lint, copied from the scripts.
- Keep the structure skimmable. A reader should be able to find the install command, the usage, and the configuration within a few seconds.
- Add the licence, the contribution notes, and the status, because a reader about to depend on the project needs all three.
- Validate the markdown. A broken link or a code block with the wrong language tag undermines everything else.
- Keep the scope on the repository root. A full documentation site is a different piece of work, and a half-built one inside a readme is worse than none.
- Do not commit or push unless the task explicitly asks for it. Writing the file is the job.

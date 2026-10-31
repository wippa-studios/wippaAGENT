# Choose the ecosystem before you write code

- Read the version first. The framework version in the lock file determines the answer far more often than the language version does. A Symfony application on 6.4 and one on 8.0 want different code, different PHP versions, and different tooling.
- Read the manifest before the source. The dependency list, the lock file, the tool configuration, and the CI definition tell you the project's constraints faster than reading implementation files.
- Match the conventions of the ecosystem, not the conventions of your favourite ecosystem. Rails uses conventions to remove decisions. Fighting them costs more than it saves.
- Check the toolchain. The formatter, the linter, the type checker, and the test runner are usually already configured, and their configuration is the project's real style guide.
- Look at how the project tests. A test file is the clearest statement of intent in any repository.
- Do not introduce a library that the ecosystem already made unnecessary. A date library, a validation library, and an HTTP client usually exist already, and the reason is a debate you do not need to re-run.
- When the project is inconsistent, follow the majority within the module you are touching and mention the inconsistency rather than normalising it in passing.

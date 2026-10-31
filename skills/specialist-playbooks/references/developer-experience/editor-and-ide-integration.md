# Editor and IDE integration

- Configure the editor through the repository, not through each developer's personal settings. The configuration belongs in version control so everyone gets the same behaviour.
- Ship the recommended extensions list and the settings file, and keep them in step with the language version and the formatter.
- Wire the language server to the project configuration so the diagnostics match the build. A language server with different settings than the compiler produces false errors that people learn to ignore.
- Configure the formatter on save, using the same tool and the same configuration the build uses.
- Set the formatter as the formatter for the file type, and disable the competing one. Two formatters fighting over a file is a diff that never settles.
- Register the task runners so the test, the build, and the debug configurations are one keystroke away.
- Provide a launch configuration for the debug entry points, so the first-run experience of a new developer does not involve reading the run script.
- Keep the extension recommendations minimal. A heavy extension list slows the editor and adds noise to the review of every change.
- Add the repository to the workspace as a folder, not as a subfolder, so the language server sees the whole project root.
- Check the indexer exclusions. A build output directory or a vendored tree that the indexer walks will make the editor slow.
- Provide a formatting and linting task in the command palette that runs the project scripts, so nobody has to remember the invocation.

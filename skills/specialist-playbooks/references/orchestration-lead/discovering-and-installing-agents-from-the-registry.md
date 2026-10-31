# Discovering and installing agents from the registry

**What to do**

- Resolve the registry before doing anything else. The default is the `wippa-studios/wippaAGENT` repository, and the `WIPPA_AGENT_REGISTRY` environment variable overrides it when set to an `owner/repo` pair. Build every endpoint from the resolved value rather than hard-coding one.
- Browse through the repository contents API. The category list comes from the `contents/categories` endpoint, the agents in a category from `contents/categories/{category}` and the raw file from the raw content path on the default branch.
- Install to one of two destinations and ask which one the user means: a global directory under the user configuration path, or a project-local `.opencode/agents/` directory. The local one is versionable and travels with the repository; the global one is available everywhere.
- Create the destination directory if it does not exist, and download the agent file with the exact bytes published. Do not reformat, reflow or "fix" the frontmatter on the way in; the file must match what the registry serves so that updates are diffable.
- Show the description before installing so the user can confirm they are choosing the agent they meant.
- Confirm before uninstalling, and remove only the named file.

**What to watch for**

- Rate limits. The unauthenticated github API allows sixty requests an hour per address, which is easy to exhaust while browsing a large catalogue. Authenticate, batch the requests, and cache the listing rather than refetching it.
- A repository whose category tree has not been published yet, in which case the contents endpoint returns an error rather than an empty list. Report the error plainly instead of presenting an empty catalogue as the truth.
- A path traversal in a category or agent name. Sanitise the components before they enter a URL and before they are used as a filename.
- Overwriting an existing agent with a different version without saying so. Keep a copy and report the difference.

**How to verify**

- After installation, the file exists at the stated path and its first lines parse as frontmatter with a description, a mode and the expected permissions.
- The installed description matches what the registry served.
- A listing request returns the expected set of names and nothing extra.

**Keeping the installed set current**

- Track where each agent came from and at what version, so an update can be applied deliberately instead of by replacing a directory.
- Before overwriting an existing file, diff the installed copy against the registry copy and show the difference. A local edit that gets silently destroyed is the most common way an installation becomes untrustworthy.
- Keep the two locations separate in your head. A project-local agent directory belongs in version control and should be committed with the project, and a global directory belongs to the machine and should not be.
- Remove an agent by deleting the file and nothing else, and confirm the path afterwards so a mistyped target cannot take out a neighbouring file.
- When the registry changes shape, re-list the catalogue rather than assuming the previous structure still holds.

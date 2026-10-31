# Local environments

- Give the developer one command that produces a working local stack. A setup that takes a wiki page and half a day will not stay correct.
- Keep the local environment close to production in shape: the same service names, the same ports, the same configuration keys, with different values. A local stack that differs structurally hides the integration problems.
- Use containers for the stateful dependencies rather than installing them natively, so the versions match and the setup is repeatable.
- Provide the seed data and the fixtures so a new developer has something to look at without a data request.
- Make the reset a command. A developer who cannot reset in a minute will not reset, and will instead work around a broken local state.
- Keep the secrets for local development in a committed file of safe placeholders, with the real values injected by the environment. Never commit a credential that works anywhere.
- Use a local proxy or a service mesh for development only when the behaviour matters. A proxy that behaves differently in production is a trap.
- Make the database seeding idempotent so it can run on every start.
- Document the version of every dependency the local environment needs, and check the local versions against production with a script.
- Watch the resource cost of the local stack. A local environment that needs a large machine gets shared with a virtual machine or a remote development environment.

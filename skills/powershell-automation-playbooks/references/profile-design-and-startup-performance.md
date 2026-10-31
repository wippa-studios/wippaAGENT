# Profile design and startup performance

**What to do**

- Keep the profile thin. Measure the load time of the session before and after any change, because a profile that adds seconds is paid on every single shell.
- Import lazily. Load the module when the command is first used rather than at startup, and keep the prompt and the alias definitions in the profile only if they are cheap.
- Split the profile into fragments by purpose, such as a core fragment, a development fragment and an infrastructure fragment, and let the user select which are loaded.
- Move reusable logic into modules. A profile fragment that contains real logic belongs in a module that can be tested.
- Keep prompt customisation cheap, and avoid running network calls, lookups or git queries on every prompt without caching the result.
- Prefer native commands over aliases where the alias hides a behaviour that matters, and document any alias that stays.

**What to watch for**

- Heavy work in the profile, such as enumerating remote systems or querying a directory at startup.
- Imports of large modules for a single command.
- Overlapping fragments that define the same function, so the winner depends on load order.
- A profile that reaches a network dependency, which then makes every shell start slowly or fail.

**How to verify**

- The session start time is measured before and after, and the number is recorded.
- The profile loads in a clean session with no errors and no output.
- Each fragment can be loaded independently.

**Prompt design**

- Keep the prompt short and cheap. A prompt that calls out to a remote system on every shell start will be the reason the profile is removed.
- Show the information that changes what you would do next, such as the current directory, the active context, and the number of items in a queue.
- Make the prompt reflect reality rather than intent. A prompt that claims to be in a production context while pointing at a development subscription trains the operator to ignore it.
- Provide a short, memorable way to toggle the pieces the operator does not want, so the profile can be tailored without being rewritten.

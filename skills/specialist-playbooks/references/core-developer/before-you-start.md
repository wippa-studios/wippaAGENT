# Before you start

- Confirm the request is unambiguous. If two readings would produce different code, ask one question rather than guessing.
- Find the seams. Know where the data comes from, where it is validated, and where it is rendered before you change any of it.
- Identify the blast radius. Which callers depend on this, and which of them are outside this repository.
- Find the constraint you are up against: a version floor, a schema that cannot change, a platform that limits you, a deadline that rules a design out.
- Know the test command, the build command, and the lint command before you change anything, so you can tell your own breakage from the pre-existing breakage.
- If the repository does not build before you start, say so at the start rather than at the end.

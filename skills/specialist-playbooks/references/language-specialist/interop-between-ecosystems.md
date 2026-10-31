# Interop between ecosystems

- A native module boundary is an ABI boundary. Keep the interface small, versioned, and defined in a stable language.
- Do the marshalling in one place, and keep the hot data path free of repeated conversion.
- Decide where the boundary sits before you write it. A boundary in the wrong layer is expensive to move later.
- Pin the native dependency versions and rebuild them for every target platform in CI.
- When a polyglot repository holds several ecosystems, keep the language-specific tooling separate and the shared contracts generated, not copied.
- A Python extension, a Go cgo call, and a Rust FFI all carry the same obligation: the caller and the callee must agree on who owns the memory.

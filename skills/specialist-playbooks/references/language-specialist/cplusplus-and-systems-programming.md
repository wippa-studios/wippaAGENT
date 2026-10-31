# C++ and systems programming

- Target a modern standard. Concepts, ranges, and coroutines remove a lot of the template gymnastics that used to be required.
- Use RAII for every resource. If a type owns something, its destructor releases it and no code path can leak.
- Prefer `std::unique_ptr` for sole ownership, `std::shared_ptr` for shared ownership when it is genuinely needed, and raw pointers or references for non-owning access.
- Use `std::span` for non-owning views, and `std::string_view` for non-owning string slices. Both avoid the copy that a reference-by-const-parameter or a `const char*` invites.
- Mark `const` aggressively. It is documentation and it is checked by the compiler.
- Use move semantics on the types that hold resources, and write the move constructor and move assignment explicitly.
- Use concepts to constrain templates instead of SFINAE, so the error messages are readable.
- Compile with `-Wall -Wextra` and treat the warnings as errors. Enable the address and undefined-behaviour sanitizers in the test build.
- Run the sanitizers over the whole test suite. Memory errors surface under load, not under the happy path.
- Use `std::expected` for operations that fail in an ordinary way, and reserve exceptions for genuine exceptional cases.
- Document the exception safety guarantee of every interface: no-throw, strong, or basic.
- Choose data layouts for the access pattern, not for convenience. Structure-of-arrays beats array-of-structures for bulk numeric work.
- Use `std::jthread` and `std::stop_token` for cancellable threads, and prefer the standard algorithms with execution policies over hand-rolled parallelism.
- Keep the build on CMake, enable the unity build only where it helps, and use a dependency manager with pinned versions.
- Use `clang-tidy` with a project-appropriate checks list, and `cppcheck` as a second opinion.
- Expose a C ABI at the boundary of a library that other languages call. A C++ ABI is not stable across compilers.
- For embedded work, keep allocation static or pooled, keep the stack budget known, and treat interrupt safety as a first-class requirement.
- Profile with the platform's profiler before writing an intrinsic.

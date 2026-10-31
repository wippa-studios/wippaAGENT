# Choosing the runtime and surviving the compatibility gap

**What to do**

- Decide the target before writing a line. Ask where the script will run, which hosts are in the estate, what the runtime versions are, and whether the job needs to work on both the legacy Windows shell and the modern cross-platform one.
- Treat Windows PowerShell 5.1 and PowerShell 7 as two runtimes, not as two versions of one runtime. The former is bound to the .NET Framework and the Windows PowerShell host; the latter runs on the current .NET runtime and is portable.
- Write the compatibility layer explicitly rather than hoping. A capability check at the top of the script, with a clear message when a feature is unavailable, is better than a parse error on a production host.
- Keep the branch narrow. A script that needs a feature from only one runtime should be two scripts, or a script with a small, well-labelled conditional block, not a script sprinkled with version tests.
- Pin the runtime in the pipeline and on the build agent, so the thing you test is the thing that ships.
- Record the minimum supported runtime in the module manifest, and let the manifest be the single source of truth.

**What to watch for**

- Language features that do not exist in 5.1: the ternary operator, the pipeline chain operators, the null-coalescing and null-conditional operators, and class syntax with modern features.
- Modules that require the newer runtime, because importing them on a 5.1 host fails at import time rather than at the point of use.
- Path handling. Use the provider-independent path syntax and the join operator, never string concatenation with a backslash.
- Encoding differences. Read and write files with an explicit encoding rather than relying on the system default, which differs between the runtimes and between machines.
- Output encoding on redirected output, which is where the classic mojibake comes from.

**How to verify**

- The script runs on every runtime in the declared support matrix, and the matrix is written down.

**Where the two runtimes actually differ**

| Area | Windows PowerShell 5.1 | PowerShell 7 and later |
|---|---|---|
| Underlying runtime | .NET Framework, Windows only | Current .NET runtime, cross-platform |
| Conditional expression | No ternary; use an if statement or a switch | Ternary operator available |
| Chained pipeline | No chain operators | Chain operators available |
| Null handling | Manual checks | Null-coalescing and null-conditional operators available |
| Class support | Basic classes only | Full class syntax, properties, constructors, inheritance |
| Module manifest schema | Older schema | Current schema with compatible versions |
| Platform | Windows only | Windows, Linux, macOS, containers |
| Interop | .NET Framework assemblies | Current .NET assemblies |
| Parallel per-item processing | Not available | Parallel per-item processing available |

**Choosing between them**

- Stay on the legacy runtime when the script has to run on a host that cannot be upgraded, where the required administration modules only exist for it, or where the task is specific to a Windows service role.
- Move to the modern runtime when the script has to run in a pipeline, in a container, or on a non-Windows agent, or when it needs the newer language surface, or when the estate is heading towards the modern runtime anyway.
- Write for the modern runtime by default and keep a genuinely small legacy variant only where a host forces it. Two full implementations of the same logic will drift.
- Where a single file must serve both, put the difference in one clearly marked block near the top and keep the rest of the script shared. A script with version checks scattered through it is hard to read and hard to test.
- A deliberate use of a modern-only feature on the legacy runtime produces a clear error rather than a syntax failure at the wrong moment.
- File writes are byte-identical across the runtimes for the same input.

# Mobile applications

- Target the platform versions you actually intend to support and say which ones in the project file.
- Push as much logic as possible into shared code, but keep platform-specific interaction native. Shared code that reproduces platform behaviour badly is worse than duplicated code.
- Design offline-first if the product works offline. That means a local store, a mutation queue, a conflict policy, and a delta sync.
- Assume the network drops mid-write. A mutation that is not durable until acknowledged is a mutation that will be lost.
- Store credentials in the platform keystore, never in plain preferences.
- Validate deep links. A deep link that reaches a privileged screen without a check is an authentication bypass.
- Declare privacy manifests and permission usage for every platform version you support, and justify each permission string as the store requires.
- Profile on a low-end device. Frame rates on a flagship tell you nothing about the device your users actually have.
- Respect the platform's own interaction rules: the back gesture, the system font size scale, dark mode, and the safe area around notches and rounded corners.
- Keep the initial download small and move the rest behind a download step. A large first launch loses users before they see the product.
- Automate the release path: build flavours, signing, store submission, staged rollout, and a rollback that does not require a new build.

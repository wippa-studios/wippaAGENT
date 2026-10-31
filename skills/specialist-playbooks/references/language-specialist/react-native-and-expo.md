# React Native and Expo

- Read the SDK version. The New Architecture with the Fabric renderer and Turbo Modules is the default on the current SDK, and the old bridge is a legacy path.
- Use Expo Router for file-based routing, with typed routes so a bad path is a compile error.
- Use platform-specific file extensions for the cases where the platform genuinely differs, and keep the shared component above them.
- Use React Query or an equivalent for server state, and a small store for client state.
- Keep secrets in secure storage, not in AsyncStorage.
- Use the config plugin system for native customisation that the managed workflow cannot express. Anything added to the native project directly is lost on the next prebuild.
- Use Reanimated for animation on the UI thread, and Gesture Handler for gestures.
- Use a virtualised list implementation that handles large data sets, and `expo-image` for caching and blurhash placeholders.
- Configure the app config in TypeScript so the environment configuration is typed and reviewable.
- Set up EAS build profiles for development, preview, and production, and keep signing in the EAS credential store rather than in the repository.
- Use EAS Update for JavaScript-only fixes, and keep runtime versions aligned so an update never lands on an incompatible native build.
- Test with the React Native Testing Library, and use a device-level automation tool for the flows that cross native boundaries.
- Profile with the platform's developer tools and check the frame rate on a low-end device.
- Add crash reporting and symbolication before the first public release, not after the first crash report.

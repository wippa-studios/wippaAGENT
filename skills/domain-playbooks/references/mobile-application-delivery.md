# Mobile application delivery

**What to do**

- Choose the platform strategy deliberately. Native Swift and Kotlin give the best platform fidelity. React Native, Flutter, Expo and Ionic trade some of that for shared code. Decide on the basis of the native surface you actually need, not on headcount.

**The working stack**

- iOS: Swift with SwiftUI, UIKit where the newer toolkit has no equivalent control, Core Data for the local store, CloudKit for the sync, WidgetKit for the extensions, ARKit for the spatial features, and TestFlight for the distribution before the store.
- Android: Kotlin with Jetpack Compose, Material 3 for the design system, Room for the local database, WorkManager for the deferred work, the navigation component for the flow, DataStore for the preferences, CameraX for the capture, and the Play Console for the release.
- The cross-platform toolchains already named are joined by NativeScript, Xamarin and Ionic for the long tail of estates that need a shared codebase with an existing native base.
- Services and security: the Apple push service and Firebase Cloud Messaging for the notification path, the platform keystores for credential storage, and certificate pinning where the client holds a bearer token.
- Architect for offline from the first version. Local persistence, a write queue, explicit conflict resolution, and background sync. Retrofitting offline behaviour onto an app with a single remote source of truth is a rewrite.
- Keep secrets off the device. Store credentials in the platform keystore, and where a bearer token genuinely must exist, treat the device as hostile and scope the token narrowly.
- Push is a state machine. Handle permission denial, cold start from a notification, notification action routing, and the case where the token rotates.
- Instrument the performance budget: cold start time, memory ceiling, binary size, and crash-free session rate.

**What to watch for**

- Background execution limits. Schedule work through the platform work manager rather than assuming a background process runs.
- Deep link routing that loses state when the app was killed.
- Device fragmentation on Android and the old-device floor on iOS.
- Certificate pinning that breaks when the provider rotates the certificate.
- Store rejection causes: missing privacy declarations, in-app purchase rules, and account deletion requirements.

**How to verify**

- Tests on real hardware, not only simulators.
- A cold start measurement on the oldest supported device.
- Crash-free session rate from the crash reporting service over a stated window, plus a manual reproduction of every fixed crash.
- Accessibility review against the platform guidelines, including screen reader traversal and dynamic type at the largest setting.


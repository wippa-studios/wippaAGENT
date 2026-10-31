# Flutter

- Use a feature-first folder structure with the domain, data, and presentation layers separated.
- Use a state management approach that the project already uses. Riverpod, BLoC, and Provider each work; mixing them does not.
- Keep the widget tree shallow. A deeply nested build method is a design that is hard to change.
- Use `const` constructors wherever the arguments allow, since it is the cheapest performance win available.
- Use `CustomPainter` for custom drawing and `RepaintBoundary` to limit repaint scope.
- Build long lists with `ListView.builder` and give items stable keys.
- Use `FutureBuilder` and `StreamBuilder` sparingly, since they rebuild on every state change. A dedicated state object gives finer control.
- Use platform channels for native capability, and keep the channel interface small and typed.
- Use `MethodChannel` for calls, `EventChannel` for streams, and a platform view only when native widgets are genuinely required.
- Handle the platform's own navigation expectations, including the Android system back gesture.
- Support text scaling and respect the platform accessibility settings, including screen readers and the semantic tree.
- Test widgets with the widget tester, and test the business logic separately.
- Keep the bundle small. Every asset is a download, and the app store enforces limits.

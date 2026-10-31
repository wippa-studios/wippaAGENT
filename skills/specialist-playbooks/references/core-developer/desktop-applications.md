# Desktop applications

- Treat the renderer as untrusted. Context isolation on, Node integration off, a strict content security policy, and all privileged capability reached through a narrow preload bridge.
- Validate every IPC channel name and payload on the main side. The renderer is attacker-controlled input.
- Expose a small, typed, explicit surface across the bridge rather than a general-purpose invoke that forwards anything.
- Load remote content only after an explicit decision, and never give it a privileged channel.
- Integrate natively where it matters: menus, tray, notifications, file associations, protocol handlers, global shortcuts.
- Keep the main process thin on business logic and heavy on coordination. It is the easiest process to restart and the most damaging to lose.
- Sign the binaries, notarise on macOS, and verify update signatures before applying them.
- Ship an update path with rollback, because a bad release on a desktop app reaches users on a schedule you do not control.
- Watch startup time, idle memory, and window churn. Desktop apps live for days, so a slow start is felt every morning.
- Handle the platform differences explicitly: permissions dialogs, taskbar and dock behaviour, path conventions, and case-sensitive filesystems.

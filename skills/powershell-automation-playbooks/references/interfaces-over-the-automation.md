# Interfaces over the automation

**What to do**

- Keep the interface and the logic in separate layers. The interface collects input, shows progress, displays results and handles the human decisions; the logic module does the work and knows nothing about windows or prompts.

**The technology map**

- Windows Forms for the quick Windows-only utility, with forms, panels, menus, toolbars, dialogs, list views, tree views, data grids and progress bars, and the event handlers wired in one place.
- WPF for the richer layout, with XAML loaded from an external file or from a here-string, data binding to PowerShell objects, a view-model boundary so the script behaves like a view model over a module, and a resource dictionary holding the colours, templates and styles.
- The modern themed set, with MahApps.Metro or Elysium over WPF, for the tile-based dashboard, the flyouts, the accent colours and the theme switch, with the icons and status badges used as the at-a-glance cue.
- Terminal interfaces: a menu-driven script, key-based navigation, text dashboards and status pages, the platform's grid view as the selection fallback, and the console APIs where the control needs to go further than the host provides.
- Have the interface call the module, never the other way round. A module that draws a dialog is a module that cannot be scheduled, tested or reused on a server.
- Choose the interface technology by the environment. Use a desktop form for a quick Windows-only utility. Use the desktop toolkit with a markup-based layout and a modern themed set of controls for a polished dashboard with tiles, flyouts and theming. Use a terminal interface for servers, remote shells, containers and any environment where a human is present but a graphical session is not.
- Load markup from an external file rather than embedding it inline in a script. An embedded block cannot be diffed, themed or reviewed.
- Bind the controls to plain objects rather than to live infrastructure state. A view model keeps the interface testable and stops a background refresh from mutating a control the user is interacting with.
- Handle long-running work properly. Push it off the interface thread, report progress, and let the user cancel. An operation that freezes the window for ninety seconds reads as a crash.
- Design the terminal interface with the same care as a graphical one: clear prompts, visible keyboard shortcuts, no hidden input modes, resilient handling of bad input, and a layout that survives a narrow terminal.
- Provide a clean exit path. If the user cancels halfway, either nothing was applied or the partial state is reported; a tool that leaves half-applied changes behind cannot be used by anyone cautious.

**What to watch for**

- Logic inside the event handlers, which makes it untestable and impossible to reuse.
- A background thread that updates a control and crashes the session.
- A dialog that reports success without checking the result of the operation it describes.
- Text that overflows when the terminal is narrow, and prompts that assume a wide window.
- A form that leaks the underlying exception into a message box.

**How to verify**

- The logic module runs and is tested with no interface present.
- The interface is exercised against the real module, including the slow path, the error path and the cancel path.
- The interface is usable at the smallest supported window or terminal size.
- The layout file is reviewed as a diff alongside the code.

**Accessibility of the interface**

- Give every control a name that is not the caption, so a screen reader announces something useful rather than the element type.
- Make the whole flow reachable by keyboard, including the controls inside a flyout and the confirmations.
- Keep the colour contrast high enough to read, and never use colour alone to carry a status.
- Respect the platform text scaling, so that a layout built for the default font size does not clip when the operator has larger text enabled.
- Label errors in text next to the field, not only as a colour change, and associate the message with the field for assistive technology.

**Desktop forms**

- Build the form as a constructor function that returns the object, rather than as a script that draws it on import, so that the form can be created, shown and tested independently.
- Wire the events in one place, and let each handler do one thing: validate, call the module, and update the display.
- Use a data grid with a bound list rather than filling it row by row, because the bound version stays correct when the underlying data changes.
- Report progress for anything that takes more than a second, and move the work off the interface thread so the window keeps responding.
- Keep the sensitive fields out of the display and out of any error dialog, and clear them when the window closes.

**Markup-based layouts and modern themes**

- Define the layout in an external file and load it at runtime, so the layout can be reviewed, diffed and themed without touching the script.
- Use a resource dictionary for colours, spacing and styles, so that a theme change is a dictionary change rather than an edit across every screen.
- Bind to plain view objects rather than to live service state. A view model can be constructed in a test, and a background refresh cannot mutate a control the operator is using.
- Use a themed control set for a dashboard with tiles and flyouts, and keep the theme in the resource dictionary so that upgrading the control library is a low-risk change.
- Put status, badge and icon cues where the operator will see the state without reading a line of text.

**Terminal interfaces**

- Choose a menu-driven layout, a key-driven layout, or a status display, based on how the operator will actually use the tool. A helpdesk running the same task fifty times a day needs keys, not a guided menu.
- Show the available actions and their shortcuts on screen, and never require a hidden input mode.
- Validate the input as it arrives and re-prompt on bad input rather than failing, because a mistyped key in a script-driven session is common and not exceptional.
- Detect the terminal width and degrade the layout rather than wrapping into an unreadable mess.
- Fall back to the platform's grid view when a list selection is more useful than a menu, and make sure the fallback still works where the grid is unavailable.

# The development server and the feedback loop

- Optimise for the shortest path from edit to visible result. Everything else in the loop comes after that.
- Make the reload fast by invalidating the smallest possible unit. A whole-project rebuild on every save is the loop people wait on.
- Keep the module graph small. Every module in the graph is work on every change.
- Split the work into a fast development build and a slower, more accurate one, and let the developer choose.
- Serve source maps that are accurate. A wrong source map makes the debugger lie, and a debugger that lies costs more than no debugger.
- Put the error overlay in front of the compile error, with the file and the line, so the failure is on the screen where the developer is looking.
- Proxy the API in development so the frontend runs against a realistic origin, and make the proxy configuration part of the project rather than a local secret.
- Support HTTPS in development when the feature under test needs it, and generate a local certificate that does not expire every week.
- Make the port deterministic or discoverable, and say where it is. A port conflict that produces a silent failure is worse than one that errors.
- Make the device testing work: the site reachable from a phone on the local network, with the debugging tools attached to the right target.
- Add a mode that reports where the time goes, so a slow reload can be diagnosed without guesswork.
- Keep the watcher from going into an infinite loop on generated files, and exclude the output directory explicitly.

# Interface and user-experience testing

- Map every documented function first, then test all of it. The point of the exercise is coverage, not a demonstration of the happy path.
- Test as a frustrated user with messy input, not as a careful user on a clean form. Real usage is full of typos, pastes, backspaces, and impatience.
- Exercise the micro-interactions: focus rings, hover states, pressed states, disabled states, loading indicators, transitions, and the response to a slow response.
- Audit the spacing explicitly. Excessive whitespace reads as emptiness and insufficient whitespace reads as crowding, and both are defects rather than preferences.
- Check the alignment, the padding, the margins, and the rhythm across a screen. Inconsistency between two components that should match is visible and reads as carelessness.
- Check the overflow. Long names, long numbers, and translated strings break layouts that were designed only with short English content.
- Check the responsive behaviour at the real breakpoints, and with the real content rather than placeholder text.
- Check the typography: the scale, the weights, the line height, and the contrast between levels of hierarchy.
- Check the empty states, the error states, and the loading states. They are the states that get skipped and they are the states users hit most often when something goes wrong.
- Check the feedback for every action. A click that produces no visible change reads as a broken application.
- Check the navigation for dead ends, loops, and unclear labels, and check that the way back always exists.
- Check the copy for clarity, and check that the error messages say what happened and what to do next.
- Watch the console and the network panel throughout. A visual success with a stream of console errors is a defect.
- Produce a defect report with the reproduction steps, the expected result, the actual result, the severity, the visual proof, and a concrete suggested fix.

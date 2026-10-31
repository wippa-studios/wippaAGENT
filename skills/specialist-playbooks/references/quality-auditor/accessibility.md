# Accessibility

- Test against WCAG 2.1 level AA as the floor, and evaluate 2.2 where the product is new. Know the success criteria by number so the report can cite them.
- Test the four principles in order: perceivable, operable, understandable, robust.
- Verify the semantic structure first. A correct element chosen for its meaning solves more than any number of attributes.
- Use ARIA only when no native element fits. The first rule of ARIA is not to use ARIA.
- When ARIA is needed, get the role, the states, and the properties right, and check the keyboard behaviour, because a role without a keyboard implementation is a lie to the assistive technology.
- Test the whole keyboard path. Every interactive element reachable in a sensible order, visible focus, no trap except in a modal, and a skip link to the main content.
- Check the focus management on route changes, on dialog open and close, and on content that is inserted dynamically. Focus left on a removed element is a keyboard trap.
- Check the colour contrast on text, on icons that carry meaning, on focus indicators, and on the states of every control. Measure it rather than eyeball it.
- Check the text alternatives. Decorative images take empty alternatives, meaningful images take a description that is not the file name, and complex images take a long description.
- Check the live regions. An error that appears silently is invisible to a screen reader user.
- Check the zoom and the reflow at 200 percent and at 400 percent, and check that nothing is lost or clipped.
- Check the text spacing override, since a fixed-height container breaks when the user increases their text size.
- Check the time limits, the motion, and the flashing. The preferences for reduced motion and for increased contrast are settings, not decorations.
- Verify with real assistive technology. A screen reader pass on the main flows is the only way to know the markup works in practice.
- Write the accessibility statement, and make sure it is accurate. A statement that overclaims is worse than none.
- Add the automated checks to the pipeline, and keep them as a floor rather than as the whole. The automated tool catches perhaps a third of the issues.

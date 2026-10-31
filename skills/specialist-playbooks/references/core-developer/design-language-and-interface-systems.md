# Design language and interface systems

- Extract the design language before you write components. The reusable artefacts are the colour tokens with named roles, the type scale, the spacing scale, the radius scale, and the elevation steps.
- Convert a design reference document into implementation instructions rather than impression. Capture the visual theme and density, the colour palette with role and hover and active states, the typography rules including weights and hierarchy, the component styles, the layout and grid rules, the elevation and shadow steps, the responsive behaviour, and the stated constraints.
- Save the extraction as a written artefact with a colour reference table so the next person does not re-derive it.
- Never adjust a brand value without a reason. If a token does not fit, add a new token rather than editing the existing one.
- Build the component set with its states: default, hover, active, focus, disabled, loading, error, and empty.
- Specify dark mode as its own palette, not as an inversion. Shadows do not invert, and saturated colours need different contrast treatment.
- Annotate motion with duration, easing, and purpose, and honour reduced-motion preferences.
- Ship accessibility annotations alongside the visual spec. Colour contrast, focus order, hit target size, and screen reader labels are design decisions, not QA findings.
- Define the responsive rules as breakpoints with content changes, not just width changes. A layout that only reflows is not responsive.
- Keep the component library versioned and published as a package when more than one application consumes it.

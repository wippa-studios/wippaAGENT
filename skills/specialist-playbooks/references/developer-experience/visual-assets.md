# Visual assets

- Clarify the asset type before anything else, because the dimensions, the format, and the constraints all follow from it.
- Produce the asset at the size the platform expects and the size the display needs. An app icon, a favicon, a social card, and a banner each have their own specification.
- Keep the icon simple enough to read at its smallest rendered size, and check it there rather than at full resolution.
- Use transparency where the platform expects it, and check the icon against both a light and a dark background.
- Extract the brand context from the design documentation rather than inventing a palette. The brand already has colours, and a new asset that ignores them is off-brand by definition.
- Write the generation prompt with the style first, then the subject, then the lighting and medium, then the palette, then the constraints. A prompt that omits the medium gets a photograph when a vector was needed.
- Prefer a flat or vector treatment for interface assets. Photographic rendering reads as a stock image at icon size.
- State the isolation and the background explicitly, so the generator does not fill the frame.
- Keep text out of a generated image unless the text is large and short, because generated typography is unreliable.
- Check the output against the specification: the dimensions, the format, the transparency, the file size, and the legibility.
- Deliver the asset to the right path with the naming convention the project uses, and record what was produced.
- When the generation tooling is unavailable, deliver a precise prompt the person can paste into any image generation interface, rather than a placeholder file.

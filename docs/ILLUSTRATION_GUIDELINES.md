# Illustration Guidelines

This document defines the standards for diagrams and illustrations used in IB learning content. Following these rules lets us run automated checks and keeps visuals clear for students and parents.

## Scope

- File format: SVG
- Location: `public/images/<subjectId>/`
- Usage: referenced from topic `notes[].illustration` objects

## Design rules

### 1. Use SVG for all diagrams

- SVGs stay sharp on every screen size and are small to download.
- Export from Excalidraw, Figma, or Inkscape; run through [SVGOMG](https://jakearchibald.github.io/svgomg/) before committing.

### 2. Always include accessible metadata

Every SVG must have:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" role="img" aria-labelledby="title desc">
  <title id="title">Short descriptive title</title>
  <desc id="desc">Longer description of what the diagram shows.</desc>
  ...
</svg>
```

### 3. Leave enough margin for labels

- Design the diagram with generous whitespace around the main subject.
- Choose a `viewBox` wide/tall enough that labels and leader lines fit without clipping.
- A common starting size is 800–1000 px wide.

### 4. Labels must not overlap or overflow

- No two text labels may overlap each other.
- No text label may overlap the main illustration, arrows, or other decorative elements.
- Text placed inside a coloured panel, chip, or backing rect must fit fully within that rect — `npm run validate:illustration-layout` flags any text that spills out of its containing box.
- When in doubt, move the label further away and use a longer leader line.

### 5. Leader lines must be clean

- Use thin (1.5 px), neutral-coloured strokes (e.g. `#6b7280`).
- Leader lines should end at distinct points when pointing to nearby features.
- Avoid leader lines crossing each other or crossing arrows.
- If a leader line must cross another line, keep the crossing angle as close to 90° as possible.

### 6. Text must be readable over coloured areas

- When a label sits on top of a coloured shape, add a small background rectangle behind the text:

```xml
<rect x="..." y="..." width="..." height="..." rx="4" fill="#f9fafb"/>
<text x="..." y="...">Label</text>
```

- Use a sans-serif font (e.g. `system-ui`).
- Minimum effective font size when rendered: 11 px for sublabels, 13 px for labels.
- **Layout validator font (2026-08-08):** `validate:illustration-layout` measures text with a vendored reference font (Roboto, `scripts/assets/validator-sans-{400,600,700}.woff2`), NOT the platform's system-ui — system-ui metrics differ per OS (SF Pro vs DejaVu) and caused CI/local gate disagreements. Author for system-ui as before, but leave a few px of slack around text: real user fonts vary too. Known false-positive class (now 4×): inline `<tspan>` runs flagged as overlapping text — split into separate `<text>` elements instead.

### 7. Use consistent colour coding

- Biology diagrams use the subject accent colour (green/emerald tones) for plant and biology-specific structures.
- Use red for oxygenated blood / high-energy paths and blue for deoxygenated blood in heart/circulation diagrams.
- Keep the palette small and consistent across diagrams for the same topic.

### 8. Keep it educationally accurate

- Diagrams must match the wording in the study notes.
- Avoid adding extra detail that is not covered in the content.
- Label only the structures students are expected to learn.

## File naming

```
public/images/<subjectId>/<topic-id>-<short-description>.svg
```

Examples:

- `public/images/biology/bio-cell-1-animal-plant.svg`
- `public/images/biology/bio-photosynthesis-1-leaf-cross-section.svg`
- `public/images/biology/bio-body-1-heart-circulation.svg`

## Integration with topics

When a note has an illustration, add it to the topic JSON:

```json
{
  "id": "bio-cell-1-n1",
  "heading": "Animal Cell vs Plant Cell",
  "body": "...",
  "illustration": {
    "src": "/images/biology/bio-cell-1-animal-plant.svg",
    "alt": "Labelled comparison of an animal cell and a plant cell.",
    "caption": "Plant cells have a cell wall, chloroplasts, and a large central vacuole."
  }
}
```

Rules:

- `src` must be an absolute path starting with `/images/`.
- `alt` must be descriptive and non-empty.
- `caption` is optional.

## Validation checklist

Before committing a new illustration, run:

```bash
npm run validate:illustrations
npm run validate:content
```

The automated checks verify:

- SVG is valid XML.
- SVG has `viewBox`, `xmlns`, `role="img"`, `<title>`, and `<desc>`.
- File size is under 50 KB.
- Any `illustration.src` referenced in topic JSON exists on disk.

Manual checks still recommended for:

- Label overlap (use the preview page or browser zoom).
- Educational accuracy.
- Colour consistency.
- Readability at mobile widths.

For the visual pass, render every SVG to PNG and review the contact sheet:

```bash
npm run render:illustrations                              # all subjects → illustration-previews/
npm run render:illustrations -- --subject=chemistry       # one subject
node scripts/render-illustrations.mjs <path-to.svg>       # one file
```

Open `illustration-previews/index.html` for a grid grouped by subject, or sweep the PNGs directly (they are plain images, so an agent can review them in batches). The output directory is gitignored — regenerate it whenever you need a fresh look.

## Anti-patterns

| Bad | Why |
|---|---|
| Labels inside a dense illustration with no backing | Text becomes unreadable over colours. |
| Leader lines crossing arrows | Creates visual clutter and confusion. |
| Multiple leader lines ending at the same point | Hard to tell which label points where. |
| Labels clipped by the SVG edge | Text is lost when the diagram is embedded. |
| Raster images (PNG/JPG) for diagrams | Blurry on retina and larger file sizes. |
| Missing `alt` or `<desc>` | Screen readers and search engines lose context. |
| Inline `<tspan>` runs to style part of a text | The layout validator measures each tspan as a separate box and flags them as overlapping. Use separate `<text>` elements with explicit `x`, or move the highlight into a badge/pill. |

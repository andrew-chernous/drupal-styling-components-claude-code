# Computed values → theme tokens

The browser reports `rgb(140, 21, 21)`; the SCSS says `$example-primary`. This file is
the lookup between them, so a verification run can say *which token is wrong*
rather than only that a color is off.

## Colors

Generate the lookup at the start of a verification run:

```sh
.claude/skills/shared/tokens.sh --rgb
```

It converts `scss/base/_colors.scss` to computed `rgb()` on every run, so the mapping
is never stale — a hand-copied table here drifted from the Sass twice before this
script existed. `drupal-component-review` reads the same script for token names.

```
rgb(140, 21, 21)    $example-primary         #8c1515
rgb(0, 154, 180)    $example-link-secondary  #009AB4
...
```

`rgba(0, 0, 0, 0)` is `transparent` — not a finding.

**Near-misses are the point of this table.** Figma exports round: a design showing
`#8C1516` against `$example-primary` `#8c1515` is a rounding artifact, not a decision.
Treat any color within ~2 per channel of a token as *that token, used wrongly* —
report the token name, not the raw hex.

A color in the render that maps to no row here is either off-palette (a real
finding) or inherited from the `example_base` parent (check before reporting — parent
values are not this component's defect, though they are worth mentioning).

## Type

The two font tokens are in `tokens.sh` output. The bare `SourceSansPro` (no `Bold`)
that appears in computed styles matches neither — it comes from the `example_base` parent's
base rules, not from a subtheme token.

**`Roboto` on body copy is the house convention, not a defect.** The Figma design
system binds `Text/Paragraph-m` to Roboto 18/26, and nine component stylesheets
(`_feature-banner`, `_stats`, `_quote`, `_testimonials`, `_icon-text`, `_footer`,
`_hero-banner`, `_faq`, `_split-card`) set `font-family: $roboto` on their
description element. A lone `Roboto` among `SourceSansPro` siblings is therefore
*expected* on a description, and "correcting" it makes that component the only one
in the theme that diverges.

This is the cautionary case for the whole skill: the frequency outlier looked
exactly like a defect, and acting on it would have introduced a real inconsistency
while reporting a fix. **Before calling any outlier a defect, check whether sibling
components do the same thing** — `rg -n 'font-family' scss/components/`. A pattern
repeated across the theme is a convention; only a genuinely unique value is a
candidate defect, and even then the design decides.

### The real font defect (theme-wide, not per-component)

Neither `Roboto` nor `SourceSansProBold` is actually loaded. Only `SourceSansPro` and the
parent theme's icon fonts (`fcl`, `lg`) have an `@font-face`; there is no Roboto file on disk and no
webfont link. Every `$roboto` and `$source-sans` declaration silently falls back to
Helvetica/Arial.

`document.fonts.check('400 18px Roboto')` returns `true` here and is **not** a valid
test — it reports whether text can be painted, fallback included. Measure instead:

```js
// A family that is not loaded renders at exactly the control width.
probe('Roboto, sans-serif') === probe('__NoSuchFont__, sans-serif')
```

Report this once as a theme-level finding. It is not a per-component defect and must
not be "fixed" inside a component stylesheet.

## Spacing

The theme runs `rem()` on every dimension, and the browser resolves back to px at
a 16px root. So `rem(24px)` → `24px` computed, and comparing px to the design's px
is valid.

Common steps: `8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 96`. A computed `padding` or
`gap` off this scale (say `18px` or `37px`) is worth a look — either the design
specifies it deliberately or a raw value slipped past `rem()`.

## Breakpoints

Widths come from `tokens.sh` (the `$mobile-*`, `$tablet`, `$desktop*` rows). What the
script cannot tell you is which ones to test at:

| Test viewport | Exercises |
|---|---|
| 1440 (desktop) | `$desktop-superwide` — where Figma frames are usually drawn |
| 768 (tablet) | `$tablet` |
| 390 (mobile) | below `$mobile-landscape` |

Verify at those three unless the design specifies different frames.

## Values that are not findings

- `opacity: 1`, `flex-direction: row`, `flex-wrap: nowrap` on a non-flex element —
  computed defaults the extraction reports regardless of authored CSS.
- `lineHeight` with a trailing `.1` (`62.1px`) — a unitless multiplier resolved
  against font-size. Compare the ratio, not the decimal.
- Total component height. It tracks content length, which differs from the design
  by design. Asserting on it produces a failure on every run and teaches everyone
  to ignore the tool.

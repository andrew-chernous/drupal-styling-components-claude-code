# Subtheme Design Tokens

The tokens live in `web/themes/custom/example_subtheme/scss/base/`. **Read the source files
for values** — this document deliberately does not copy them, because a duplicated table
goes stale the moment someone changes a hex and every later review then audits against a
value that no longer exists.

```
scss/base/_config.scss     $base (16px root) — the divisor rem() uses
scss/base/_variables.scss  breakpoints, containers, header heights, fonts, $image-path
scss/base/_colors.scss     the whole palette
scss/base/_functions.scss  rem(), focus-ring(), strip-unit(), convert-to-rem()
scss/base/_form.scss       form-specific rules
```

`_index.scss` forwards all five, so one import gets everything:

```scss
@use '../base' as *;
```

To list what is actually defined right now:

```sh
.claude/skills/shared/tokens.sh            # everything
.claude/skills/shared/tokens.sh --colors   # just the palette
```

It reads `scss/base/` on every run, so its output cannot go stale. `drupal-design-verify`
uses the same script with `--rgb` for computed-style lookups — one source, two views.

A misspelled or removed token fails the Sass build, so a bad token name cannot ship. The
failure this reference exists to catch is the opposite one: a **hardcoded value that
compiles fine** while a token for it already exists.

```sh
rg -n '#[0-9a-fA-F]{3,8}\b' scss/components/_<name>.scss   # literal colors
rg -n 'rgba?\(' scss/components/_<name>.scss               # literal rgb()/rgba()
rg -n ':\s*-?[0-9.]+px' scss/components/_<name>.scss       # dimensions that skipped rem()
rg -n '@media[^{]*[0-9]+px' scss/components/_<name>.scss   # literal breakpoints
```

## Rules the source files can't tell you

**Near-miss hexes.** `#8C1516` where the palette has `#8c1515` is a Figma rounding
artifact, not a design decision. Use the token. Same for a `#FFF` that means `$white`.

**Every dimension goes through `rem()`.** It accepts multiple values, so
`gap: rem(40px 24px)` is one call, not two.

**Use the `focus-ring($color, $offset: 3px)` mixin** rather than hand-written `outline`
rules, so focus styling stays consistent with the global `:focus-visible` treatment.

**Mobile-first, always.** Base rules first, then ascending `@media (min-width: #{$tablet})`
queries. A `max-width` query in a component file usually means the base rules were
written for desktop by mistake.

**Buttons already exist** — `.btn` plus `.btn--primary`, `.btn--secondary`,
`.btn--tertiary`, `.btn--inverted` in `scss/components/_buttons.scss`. Reach for these
before styling a link as a button.

**Values that are fine to hardcode:** `0`, `1px` hairlines, unitless `line-height`,
percentages, `1fr` and other grid units, and one-off geometry with no token equivalent
(for example the `border-radius: rem(110px)` shape on `.example-stats`). Tokens capture
values that repeat or that change together — a genuinely unique number is not one of them.

## If the theme ever needs runtime switching

These are Sass variables, substituted at build time, so a palette change means editing
`_colors.scss` and running `npm run build:scss`. That covers a rebrand. It does not cover
light/dark or two sites sharing the subtheme with different palettes — that needs CSS
custom properties with the Sass vars as fallback defaults, which is a migration rather
than a rename. Don't reach for it until a second palette actually exists.

---
name: drupal-figma-component
description: Build a Twig partial and SCSS in example_subtheme from a Figma node. Use when a Figma link or selection arrives with a request to build it for the subtheme as a component, section, or block. Runs a reuse pass over existing @example partials and example_base first, hands off to drupal-component-review, and stops before wiring (drupal-connect).
compatibility: Needs the Figma MCP server with the Figma desktop app open on the file.
---

# Figma → Drupal Component

Build components in `web/themes/custom/example_subtheme/components/` from Figma designs.

**Core rule: reuse before you create.** Most of this skill is the discovery pass that
happens *before* writing code. Do not skip it — a new component that duplicates
`section-header` or `_cta-list` is a defect, not a feature.

## Step 1 — Read the Figma design

Load the `figma:figma-design-to-code` skill **before** calling `get_design_context`
(it is a mandatory prerequisite for that tool). Then pull the design and identify:

- The layout structure and its repeating sub-elements.
- Heading + description + CTA buttons at the top → almost certainly `section-header`.
- Every color, spacing, and font size, so you can map them to existing tokens in Step 2.

Do not transcribe Figma's raw pixel/hex output into SCSS. Map it to tokens.

## Step 2 — Reuse discovery (mandatory, before writing anything)

Run all four checks and **report what you found and what you will reuse** before coding.

### a. Existing `@example` components

```bash
ls web/themes/custom/example_subtheme/components/
```

These are the shared building blocks. Prefer them over reimplementing:

| Component | Include path | Use for |
|---|---|---|
| Section header | `@example/section-header/section-header.twig` | title + description + CTAs at the top of a section |
| CTA list | `@example/buttons/_cta-list.twig` | a row of link buttons (first primary, rest secondary) |
| Button | `@example/buttons/button.twig` | any single button or link-styled-as-button |

`section-header` derives its element classes from a `prefix` you pass
(`prefix: 'example-stats'` → `.example-stats__title`), so it adapts to any block name.
It takes `heading_tag`, `wrap`, and `inverted` for layout/dark-background variants.

### b. The `example_base` parent theme

```bash
ls web/themes/custom/example_base/pattern-lab/source/_patterns/01-components/
ls web/themes/custom/example_base/scss/components/
```

The parent already ships ~45 components (cards, quote, stats, hero-banner, faq,
grid-tiles, box-icon, …). If Figma shows something the parent already renders and
the reskin only changes colors/spacing, **write an override in `scss/overrides/`
instead of a new component.** That is the cheapest correct answer.

### c. Atoms and tokens

Every color, dimension and breakpoint is a token. Read
`../drupal-component-review/references/tokens.md` and run
`.claude/skills/shared/tokens.sh` for what is defined now.

### d. Decide and state the outcome

Pick one, and say which:

1. **Pure SCSS override** of an existing example_base component → `scss/overrides/`.
2. **Compose** existing `@example` partials, new wrapper only.
3. **New component**, reusing `section-header` / `_cta-list` / `button` inside it.

## Step 3 — Build

### Twig

Create `components/<name>/<name>.twig`. A sub-element partial used only by that
component is prefixed with an underscore: `_<name>-item.twig`.

Requirements:

- Open with a **Drupal `@file` docblock** — a `/** */` block wrapped in `{# #}`,
  with an `Available variables:` list. Full format in
  `../drupal-component-review/references/drupal-docs.md`; read it before writing the
  first file. Existing components use an older ad-hoc style — **follow the
  standard, not the neighbouring file.**

  ```twig
  {#
  /**
   * @file
   * Renders a row of icon link tiles inside a tinted panel.
   *
   * Available variables:
   * - title: Section heading. Required.
   * - description: (optional) Intro text.
   * - items: Link tiles, each with an icon, title, and url key.
   */
  #}
  ```

- Root element `<section class="example-<name>">` with a `container` div inside.
- BEM throughout, block prefix `example-<name>`.
- **Always `include ... with { ... } only`** — never leak the ambient context.
- Guard every optional field with `{% if %}`; loop items with `{% for %}`.
- Defaults via `{% set x = x|default('...') %}` or `{% set x = x ?? true %}`.
- Decorative icons/images get `aria-hidden="true"`; the section gets `aria-label`.
- User-facing literal strings run through `|t`.

```twig
{% include '@example/section-header/section-header.twig' with {
  prefix: 'example-<name>',
  title: title,
  description: description,
  ctas: ctas,
} only %}
```

### SCSS

1. Create `scss/components/_<name>.scss`, opening with a Drupal `/** @file */`
   docblock (not a `//` banner), then `@use '../base' as *;`:

   ```scss
   /**
    * @file
    * Quick Links component.
    */

   @use '../base' as *;
   ```

2. Register it in `scss/_styles-main.scss` under the `// @use 'components/name';`
   marker — **the file does nothing until it is registered.**
3. Use `$root: &;` when a nested element needs to reference the block.
4. Mobile-first: base rules, then `@media (min-width: #{$tablet})`, then `#{$desktop}`.
5. All dimensions through `rem()`. All colors through tokens.

## Step 4 — Verify

```bash
cd web/themes/custom/example_subtheme
npm install           # only if node_modules/ is missing — tooling is local-only
npm run lint:scss     # must pass
npm run build:scss    # compiles scss/styles.scss → css/styles.css
```

Then confirm and report:

- [ ] Reuse pass ran; reused components named explicitly.
- [ ] No hardcoded hex/px that a token covers.
- [ ] New SCSS partial registered in `_styles-main.scss`.
- [ ] Every `include` ends in `only`.
- [ ] Docblocks follow Drupal standards: Twig `@file` + `Available variables:`,
      SCSS `/** @file */`.
- [ ] `lint:scss` and `build:scss` pass.
- [ ] Every Figma breakpoint has its own `min-width` rule set (the rendered check
      is `drupal-design-verify`'s job).

## Step 5 — Hand off

The component is built but **renders nowhere** — nothing includes it yet, and it
has had no second pass.

**Continue automatically:** invoke `drupal-component-review` to audit reuse, tokens,
and complexity, and apply the fixes. It only touches theme files you just wrote,
so there is nothing to wait for. Its report ends the run, including the offer to
wire the component, so stop once it has reported.

Include-only sub-components (like `section-header` or `_cta-list`) never need
wiring at all; they are used inside other components rather than placed as content.

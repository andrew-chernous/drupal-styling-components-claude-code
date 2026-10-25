---
name: drupal-component-review
description: Post-build audit of an example_subtheme component that applies its own fixes — reuse of existing @example and example_base patterns, tokens over hardcoded values, Drupal docblock format, SCSS complexity. Use after drupal-figma-component, or when the user asks to review or audit a component or to fix its docblocks. A single reported bug goes to drupal-fix-component.
---

# Component Review

Second pass over a component built with `drupal-figma-component`. That skill's reuse
discovery happens *before* the design is fully understood; this one runs *after*,
when the finished code shows what was actually needed.

**Core rule: this skill fixes, it does not just report.** Every finding ends in an
applied edit or an explicit reason it was left alone. A findings list with no diff
is a failed review.

## Scope

Review only the component under review and the files it touches. Do not audit
adjacent components, do not restyle things that already work, do not rename
anything for taste. Touching only the lines a finding requires outranks every
improvement idea below.

If the user names a component, review that one. Otherwise derive the scope from
`git status` / `git diff` — the untracked and modified files under
`web/themes/custom/example_subtheme/`.

## Step 1 — Establish scope and read everything

```bash
git status --short web/themes/custom/example_subtheme/
git diff -- web/themes/custom/example_subtheme/
```

Read, in full: the component's `.twig` (plus any `_partial.twig`), its
`scss/components/_<name>.scss`, any `js/components/<name>.js` it ships, any
`templates/paragraphs/paragraph--<type>.html.twig` that feeds it, and any preprocess
function added to `example_subtheme.theme`.

`js/dist/example_scripts.js` is build output. Review the source in `js/components/`;
a modified `dist` file is expected, not an edit to audit.

You cannot judge duplication from a diff. Read the whole file.

## Step 2 — Reuse audit

The single highest-value check. A component that reimplements something the theme
already ships is the defect this skill exists to catch.

### a. Was an existing partial passed over?

```bash
ls web/themes/custom/example_subtheme/components/
```

That listing is the inventory — read it rather than working from memory of what the
theme ships, because components get added and any list written here goes stale.

Look in the reviewed Twig for markup that duplicates one of them:

| Smell in the new component | Should be |
|---|---|
| `<h2>` + description + a row of links at the top | `@example/section-header/section-header.twig` with `prefix: 'example-<name>'` |
| A `{% for %}` over links emitting `.btn` | `@example/buttons/_cta-list.twig` |
| A hand-built `<a class="btn ...">` | `@example/buttons/button.twig` |

`section-header` derives element classes from `prefix`, so `prefix: 'example-<name>'`
yields `.example-<name>__title` — adopting it usually costs **zero** SCSS changes.
It also takes `heading_tag`, `wrap`, and `inverted`.

### b. Does the example_base parent already ship this?

```bash
ls web/themes/custom/example_base/pattern-lab/source/_patterns/01-components/
ls web/themes/custom/example_base/scss/components/
```

If the parent renders this pattern and the new code only changed colors and
spacing, the correct artifact is a file in `scss/overrides/`, not a new component.
Flag it. Converting a whole component to an override changes rendered markup, so
propose it (Step 6, tier 2) rather than doing it unprompted.

### c. Is the new component itself duplicated?

```bash
rg -l 'example-<name>' web/themes/custom/example_subtheme/
```

Two blocks with near-identical markup and two SCSS partials that differ only in a
color mean one component with a modifier was the right call.

## Step 3 — Token audit

Nothing may be hardcoded that exists as a token. The check is the four greps in
`references/tokens.md` (literal colors, `rgba()`, raw `px`, literal breakpoints),
run from `web/themes/custom/example_subtheme` against the component's partial.

Every hit must resolve to a token or be justified in a comment. **Read
`references/tokens.md`** — it points at the token source files in `scss/base/` and
gives the commands that list what is defined right now, plus the rules the Sass
cannot state: near-miss hexes, `rem()` on every dimension, the `focus-ring()` mixin,
mobile-first ordering, and the short list of literals that are fine to leave alone.

A misspelled token fails the build, so the defect worth hunting here is the
opposite one — a hardcoded value that compiles cleanly while a token for it exists.

## Step 4 — Documentation audit

**Read `references/drupal-docs.md`** for the required format of each file type.
The theme's older components use an ad-hoc style — the standard is the target,
so a file matching its neighbours is still a finding.

Check each file the component touches:

```bash
cd web/themes/custom/example_subtheme
head -20 components/<name>/<name>.twig
head -10 scss/components/_<name>.scss
```

| Smell | Should be |
|---|---|
| `Parameters:` heading in a Twig docblock | `Available variables:` |
| `name (string\|null) — description` | `- name: (optional) Description.` |
| Twig comment with no `/** @file */` inside it | `{#` + `/** @file … */` + `#}` |
| `// COMPONENT — Subtheme` banner atop a SCSS file | `/** @file */` docblock |
| `─────` or `=====` divider rules | Deleted |
| `Implements hook_preprocess_paragraph__<type>().` | `Implements hook_preprocess_HOOK() for paragraph templates.` |
| Hook docblock with prose on the `Implements` line | Rationale as a second paragraph |

Converting a docblock changes no rendered output, so these are tier-1 fixes.
Fix the files the component owns; do **not** sweep the rest of the theme —
unrelated components get converted when someone next edits them.

A docblock in correct Drupal syntax that restates the markup is still a bad
comment. Reformatting is not a reason to keep content that says nothing.

## Step 5 — Complexity audit

The design is simple; the SCSS should be too. Look for:

- **Nesting past three levels.** `&__el` inside `.example-<name>` is level two; deeper
  than three means the BEM class was not doing its job.
- **Selectors fighting the cascade.** `!important`, ID selectors, or long descendant
  chains added to beat `example_base/css/styles.css`. The subtheme loads at weight 100,
  *after* the parent — a plain `.example-<name>__title` already wins. Delete the
  escalation and confirm the rule still applies.
  (The two `!important` rules in `_styles-main.scss` are a deliberate global focus
  reset — leave them.)
- **Redeclared inherited values.** A `font-family: $roboto` or `color` that matches
  what the parent already sets on that element is noise.
- **Media queries that restate the base rule** with an identical value.
- **Dead rules** — a class in SCSS that appears in no Twig:
  ```bash
  rg -o '&__[a-z0-9-]+' scss/components/_<name>.scss | sort -u
  rg -o 'example-<name>__[a-z0-9-]+' components/<name>/ | sort -u
  ```
  Anything in the first list and not the second is dead. Delete it.
- **Desktop-first leakage** — a `max-width` query in an otherwise mobile-first file.
- **An abstraction used once** — a mixin, `%placeholder`, or `$variable` local to
  this component with a single call site. Inline it.

## Step 6 — Apply the fixes

Sort every finding into one of the two tiers defined in `../shared/fix-tiers.md`,
and keep the tiers as separate edits.

**Tier 1 — apply immediately.** Typical edits:

- Hardcoded value → existing token (including near-miss hexes).
- Raw `px` → `rem()`.
- Literal breakpoint → `#{$tablet}` and friends.
- Hand-written focus `outline` → `focus-ring()`.
- Missing `only` on an `include`.
- Dead SCSS rule removed.
- Unnecessary `!important` / over-specific selector reduced.
- Single-use local abstraction inlined.
- Missing `|t` on a user-facing literal; missing `aria-hidden` on decorative markup.
- Docblock converted to the Drupal format (Step 4) — Twig `@file` +
  `Available variables:`, SCSS `/** @file */`, PHP `Implements hook_preprocess_HOOK()`.
- Component's SCSS partial missing from `_styles-main.scss` — **the file does
  nothing until registered**, so add the `@use` under the `// @use 'components/name';`
  marker. The existing list is not alphabetical; append rather than resort it.
- Component's JS missing from `js/example_scripts.js` — same trap, same fix. A file in
  `js/components/` is dead code until an `import './components/<name>';` line is
  added to that entry point, which is what esbuild bundles into `js/dist/`.

**Tier 2 — propose, then wait.** Typical proposals:

- Replacing a hand-rolled header block with `section-header`.
- Collapsing the component into an `scss/overrides/` file.
- Merging two components into one with a modifier.
- Any change to the Twig element structure or class names.

## Step 7 — Verify

```bash
cd web/themes/custom/example_subtheme
npm run lint:scss     # must pass
npm run build:scss    # compiles scss/styles.scss → css/styles.css
```

If the component ships JS, also:

```bash
npm run lint:js       # must pass
npm run build:js      # bundles js/example_scripts.js → js/dist/example_scripts.js
```

`build:scss` writes `css/styles.css` and `build:js` writes `js/dist/example_scripts.js`;
those files being modified is expected output, not an accidental edit.

If any rendered output changed, view the component in the browser before reporting
done — the `run` skill covers launching the site.

## Report

Restate the outcome against these criteria, each marked pass / fixed / proposed:

- [ ] Reuse: existing `@example` partials used where applicable; no example_base component rebuilt.
- [ ] Tokens: no hardcoded color, breakpoint, or raw `px` that a token covers.
- [ ] Complexity: nesting ≤ 3, no unjustified `!important`, no dead rules, no single-use abstraction.
- [ ] Twig: every `include` ends in `only`; BEM `example-<name>`.
- [ ] Docs: Drupal format in every touched file — Twig `@file` +
      `Available variables:`, SCSS `/** @file */`, PHP hook docblock with the
      generic hook name.
- [ ] SCSS partial registered in `_styles-main.scss`; any component JS imported in
      `js/example_scripts.js`.
- [ ] `lint:scss` and `build:scss` pass — plus `lint:js` / `build:js` if the
      component ships JS.

List tier-1 fixes applied (file:line), tier-2 items awaiting a decision, and
anything deliberately left alone with the reason.

Then check whether the component is actually wired up:

```bash
rg -n "@example/<name>/" templates/
```

No hits means it renders nowhere. Wiring it is a separate decision, because the
paragraph type and its fields often do not exist yet, and a bridge written against
missing fields looks finished while rendering nothing. So end by saying it is not
connected and offer the next step rather than taking it:

> `quick-links` is built and reviewed, but nothing includes it yet, so it renders
> nowhere. When the paragraph type and fields exist in Drupal, run
> `/drupal-connect` and I'll write the bridge template. I can also just tell
> you which fields it needs.

If the user says the fields are ready, or asks to connect it now, invoke
`drupal-connect`.

Include-only sub-components used inside other components need no wiring.

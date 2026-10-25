---
name: drupal-fix-component
description: Diagnose and fix one reported symptom in an existing example_subtheme component — a style bug, broken JS behavior, or a Drupal wiring gap (wrong field mapping, missing preprocess guard, raw-vs-rendered mistake in a bridge). Use when the user names something specific that is wrong ("quick-links wraps wrong on mobile", "the CTA isn't showing up"). A whole-component audit is drupal-component-review; a new component is drupal-figma-component; a symptom reported against the Figma design with a node URL is drupal-design-verify.
---

# Fix Component

A targeted repair, not an audit. The user points at something specific that is
wrong with a component already in the theme — layout, JS behavior, or a Drupal
wiring gap — and this skill finds the cause and fixes only that.

This is not `drupal-component-review`. That skill sweeps a whole component for
reuse, tokens, docs, and complexity after it's built. This one starts from a
symptom, and stops once the symptom is gone. Don't fold in an unrelated audit
just because you're already in the file — change only the lines the symptom requires.

## Step 1 — Pin down the symptom

Before opening any file, restate the bug as an observable: what happens, what
should happen instead, and at what breakpoint / interaction / condition it
shows up. If the user's report is vague ("quick-links looks off"), ask one
focused question rather than guessing at a repro.

This restatement is also your "done" criteria for Step 5 — write it down.

## Step 2 — Locate the component and read the relevant files

```bash
cd web/themes/custom/example_subtheme
ls components/ | rg -i '<name>'
rg -ln '<name>' templates/paragraphs/ templates/views/ templates/block/
```

Read only what the symptom implicates — don't read the whole component tree
on a one-line CSS fix:

| Symptom | Read |
|---|---|
| Layout, spacing, color, breakpoint | `scss/components/_<name>.scss` |
| Click/toggle/modal/animation behavior | `js/components/<name>.js` (never `js/dist/`, that's build output) |
| Wrong/missing/empty field content | The bridge template feeding it (`templates/paragraphs/paragraph--<type>.html.twig` or view/block equivalent) and, if the field is a paragraph/media reference, `example_subtheme.theme` |
| Markup structure itself | `components/<name>/<name>.twig` |

If the symptom could span more than one of these (e.g. "the tile grid breaks
on 2 items" could be SCSS or a Twig loop assumption), read both rather than
guessing which layer is at fault.

## Step 3 — Find the cause before editing

Resist patching the symptom where it's visible if the cause is one layer up —
that produces a fix that regresses the next time content changes. Common
mismatches in this theme:

- **A CSS symptom caused by a Twig/data shape problem.** E.g. a grid rule
  assumes a fixed item count but the bridge can pass 1–N items. Fix the CSS to
  handle the real range, not the specific count the user saw.
- **A "field not showing" bug caused by raw vs. rendered.** `field_x.value` is
  the raw stored value; `content.field_x|field_value` is the rendered,
  filtered output. Rich text read raw skips CKEditor's filters and can look
  empty or broken. Check which one the bridge uses — see Step 4 of
  `../drupal-connect/SKILL.md` for the full rule.
- **A "nothing happens on click" bug caused by the JS not being bundled.** A
  file in `js/components/` is dead code until it's imported by
  `js/example_scripts.js`, which esbuild bundles into `js/dist/example_scripts.js`.
  Check the import exists before debugging the handler itself.
- **An empty/fatal-erroring field caused by a missing guard in preprocess.**
  Editors leave fields blank. `example_subtheme.theme` preprocess functions must
  guard with `hasField()` + `isEmpty()` and default with `?? ''` — an
  unguarded `->value` on a blank field is a fatal error on a page that worked
  yesterday. See `../drupal-connect/references/field-patterns.md` for the
  full guard recipe.
- **A visual bug caused by fighting the cascade**, not the component's own
  rule. The subtheme's `styles.css` loads at weight 100, after `example_base` — a
  plain `.example-<name>__el` selector already wins. If you're reaching for
  `!important` or a longer selector to make a fix stick, the actual bug is
  probably a more specific rule elsewhere in the same file, or a token/value
  mismatch, not a specificity problem.

## Step 4 — Fix it

Ground rules that apply regardless of layer:

- **Tokens, not hardcoded values.** If the fix touches SCSS and a color,
  breakpoint, or spacing value already has a token, use it — never introduce
  a new hex or raw `px` while fixing something else. See
  `../drupal-component-review/references/tokens.md` for the token sources and
  the `rem()` / `focus-ring()` conventions.
  When the right value depends on the design rather than a token and the user
  has a Figma node URL, `drupal-design-verify` is the authority — hand the
  symptom to it.
- **Field names follow CLAUDE.md's field-name rule.** If the cause is a wrong
  or missing field mapping, confirm the real machine name with the user or at
  `/admin/structure/paragraphs_type/<type>/fields`; a sibling bridge with the
  same shape gives a candidate to confirm, not an answer. A wrong `field_*`
  fails silently (empty render, no error). Until the name is confirmed, report
  the cause and the name to check instead of editing.
- **Keep `{{ attributes }}` and `only`.** If you're editing a bridge template,
  don't drop the attributes wrapper (contextual links, cache metadata) or let
  an `include` lose its `only` — both are easy to lose while chasing a fix and
  both fail silently.
- **Docblock only if you touched what it documents.** Fixing a bug is not a
  license to rewrite the whole file's comments (that's `drupal-component-review`'s
  job) — but if your fix changes a prop's behavior or a function's contract,
  update the line that describes it so the docs don't lie. Format per
  `../drupal-component-review/references/drupal-docs.md`.
- **Comments follow CLAUDE.md's comment rule**: default to none, and an obvious
  one is deleted, not reworded, in every file you touch.
- **Smallest change that removes the cause.** No refactor, no "while I'm here"
  cleanup, no touching a sibling component with the same smell. If you spot
  one, mention it in the report instead of fixing it.

## Step 5 — Verify

Run the lint and build pair for each layer you changed, from CLAUDE.md's Commands
(`lint:scss` + `build:scss`, `lint:js` + `build:js`). After a bridge template or
preprocess change, run `fin drush cr`; if it fails, say so and tell the user to
clear caches at `/admin/config/development/performance`.

Then check the fix against the Step 1 observable — in the browser if the
symptom was visual/interactive (`run` skill covers launching the site), by
re-reading the bridge output if it was a data issue.

## Report

State the original symptom, the root cause found (name the file:line), the
fix applied, and confirm the Step 1 observable no longer reproduces. Name the
source that confirmed any field name the fix touches. If
you noticed an unrelated issue while in the file, name it instead of fixing
it.

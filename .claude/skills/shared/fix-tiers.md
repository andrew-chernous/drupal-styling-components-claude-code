# Fix tiers and finding states

Shared by `drupal-component-review` (Step 6) and `drupal-design-verify` (Step 7).
Each skill keeps its own list of typical edits; this file is the rule that sorts
them. When the two lists disagree with the rule, the rule wins.

## Tiers

**Tier 1 — the edit cannot move anything on the page.** It changes a value, not
the layout: a token or `rem()` swap, a colour, font-family, font-size,
line-height or radius, `focus-ring()`, a missing registration or import line, a
docblock, a filter or attribute added in Twig (`only`, `|t`, `aria-hidden`), dead
code removed, a single-use abstraction inlined. Apply it, under the calling
skill's gate (verify applies only when fixes were asked for).

**Tier 2 — the edit can change layout flow or what other files target.** Propose
it with the concrete edit and the risk in two or three lines, then wait. This
covers element structure, order or class names; flex/grid direction, wrap or
column ratio; a new breakpoint; merging components or converting one to an
override; and **any spacing or size change on an element inside a wrapping row
or a fixed-width track**, because it can rewrap the row. Spacing elsewhere is
tier 1.

A user who has already said to apply everything has approved tier 2.

## Finding states

| Term | Meaning | Report mark |
|---|---|---|
| observation | Noted for judgement, not a failure (test content, a screenshot detail) | listed under Observations |
| divergence | A measured difference between the rendered value and the design, before any filter | not reported on its own |
| finding | A divergence or code smell that survived the filters and is sorted into a tier | — |
| defect | A finding that is this component's to fix | `✗`, with `file:line` and FIXED / PROPOSED |
| theme-level | Real, but not this component's to fix (theme-wide or inherited from the parent theme) | `⚠` |
| unverified | Not checked: variant absent, breakpoint skipped, design source unavailable | `?` |

A "smell" in component-review is the code shape that produces a finding.

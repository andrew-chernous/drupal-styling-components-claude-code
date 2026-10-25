# ADR-003 — One global subtheme stylesheet, loaded after the parent

**Status:** Accepted
**Recorded:** 2026-10-25. The decision predates the component workflow; the reason
below is the author's account, recorded at that date.

## Context

The subtheme reskins components that `example_base` already styles. It needs a way
for its rules to win over the parent's without per-rule specificity fights.

## Decision

`example_subtheme.libraries.yml` ships one global `css/styles.css` at weight 100,
so it loads after `example_base/css/styles.css` and wins on load order alone. Every
component's SCSS partial compiles into that one file through `_styles-main.scss`.
There are no per-component libraries and no `attach_library` calls.

## Consequences

- A plain `.example-<name>__el` selector already beats the parent, so
  `!important` or a longer selector to override `example_base` is almost always a
  mistake. The review skill treats one as a finding.
- A new SCSS partial does nothing until it is registered in `_styles-main.scss`.
  Every build and review step checks the registration.
- Every component's CSS loads on every page, whether the page uses it or not.
- The parent's whole component library is already on the page, so a reskin that
  only changes colours or spacing is an override in `scss/overrides/`, not a new
  component.

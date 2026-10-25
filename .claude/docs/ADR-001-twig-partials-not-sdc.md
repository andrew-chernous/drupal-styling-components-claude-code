# ADR-001 — Components are plain Twig partials, not Single Directory Components

**Status:** Accepted
**Recorded:** 2026-10-25. The decision predates the component workflow; the reason
below is the author's account, recorded at that date.

## Context

`example_subtheme`'s component library was built before Single Directory
Components (SDC) were stable in Drupal core. Its components are plain Twig files
under `components/`, resolved through the `@example` namespace that
`example_subtheme.info.yml` maps to that folder. Migrating them to SDC was never
judged worth the cost.

## Decision

Components stay plain Twig partials. There are no `*.component.yml` manifests,
and a component renders only when a template includes it: a paragraph, views or
block template, or `page.html.twig`.

## Consequences

- Nothing is discovered automatically. A built component is inert until a bridge
  template includes it, which is why the workflow treats wiring as its own step
  (`drupal-connect`).
- A component's inputs are documented by its Twig docblock (`Available
  variables:`), not by an SDC schema. `drupal-connect` reads that docblock as the
  component's contract.
- Adding a `*.component.yml` implies a component model the theme does not use.
  The skills and CLAUDE.md say not to.
- Moving to SDC later is a superseding ADR, not an edit: every skill encodes this
  decision and would need revising with it.

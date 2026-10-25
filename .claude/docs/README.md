# Documentation

Project documentation, one file per document, prefixed by type.

| Type | Meaning | Lifecycle |
|---|---|---|
| **BCP** | Best Current Practice — the recommended way to do a recurring task, given how things work today | Living; edit when the situation changes |
| **ADR** | Architecture Decision Record — one decision, its context and consequences | Immutable; supersede rather than edit |
| **RFC** | Request for Comments — a proposal circulated before a decision | Closes when the decision is made |
| **NFR** | Non-Functional Requirements — constraints on system qualities (performance, accessibility, uptime) | Living |

RFC and NFR have no documents yet; the rows are the convention to use when one is
needed.

Number within each type in creation order: `BCP-001`, `BCP-002`, `ADR-001`.

## Index

- [BCP-001 — Building Components: Figma → Drupal](BCP-001-component-workflow.md)
  How to use the six `drupal-*` skills to take a Figma design through to a rendering,
  design-verified Drupal component, and the environment constraints that shape it.
  Includes why verification compares computed values rather than diffing pixels,
  and why an obvious SCSS comment gets deleted rather than reworded.

- [ADR-001 — Components are plain Twig partials, not SDC](ADR-001-twig-partials-not-sdc.md)
  Why there are no `*.component.yml` files, and why a built component renders
  nowhere until a bridge template includes it.

- [ADR-002 — Design verification compares computed values, not pixels](ADR-002-values-not-pixels.md)
  Why `drupal-design-verify` checks bound Figma variables and tokens instead of
  diffing screenshots, and what that rules out.

- [ADR-003 — One global subtheme stylesheet, loaded after the parent](ADR-003-global-stylesheet.md)
  Why the subtheme wins on load order, and why `!important` against the parent is
  almost always wrong.

- [CLAUDE-example.md — the project CLAUDE.md](CLAUDE-example.md)
  The instructions file the original project ran with, and the file the skills
  mean by "CLAUDE.md". Not typed or numbered: it is a template to copy into a
  project root, not a document about one.

- [BCP-002 — Evaluating a skill before trusting it](BCP-002-skill-evals.md)
  How a skill is run with and without itself against real prompts, how the
  regex grader scores the two reports, and why variance across runs matters
  more than the pass-rate delta.

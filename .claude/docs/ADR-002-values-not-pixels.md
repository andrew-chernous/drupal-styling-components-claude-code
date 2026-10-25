# ADR-002 — Design verification compares computed values, not pixels

**Status:** Accepted
**Recorded:** 2026-10-25. The decision was made when `drupal-design-verify` was
built; BCP-001 (reviewed 2026-08-10) carried it until now.

## Context

A built component has to be checked against its Figma design. The obvious method
is to screenshot both and diff the images. Rendered Drupal content is never the
mockup's placeholder copy, so a pixel diff fails on every run for reasons nobody
cares about. The usual response is to raise the tolerance until the failures
stop, and by then the diff is blind to the defects worth catching. A diff result
("12% of pixels differ") also names no file and no line, so nothing can be fixed
from it and no rule can be learned from it.

## Decision

`drupal-design-verify` compares **computed styles** from the rendered page with
the **variables the Figma design binds** and the theme's tokens, in three layers:

1. Token conformance: every painted colour, type pair, radius and spacing step
   maps to the token the design binds.
2. Structural invariants: relationships that survive content changes (column
   ratios, stacking order, which corner is notched), never absolute heights.
3. Screenshots, last, for human judgement only. Never a pass/fail gate.

## Consequences

- A finding names a value, a file and a line ("line-height 26px where the design
  binds Heading/xs = 32px"), so it can be fixed and turned into a rule.
- Verification needs the Figma variables. When they are unavailable, the run
  stops and says so; it does not fall back to comparing screenshots.
- Content-dependent measures are excluded by design: total component height is
  never asserted.
- Visual weight, crop and "looks wrong" are left to a person reading the
  screenshots; the tool reports them as observations.

## Alternatives considered

- **Pixel diff with a tolerance.** Rejected for the reasons in Context. It will be
  proposed again; this record is why it is not used.
- **Screenshot comparison by the agent.** Rejected for the same reason, plus it
  presents a judgement as a measurement.

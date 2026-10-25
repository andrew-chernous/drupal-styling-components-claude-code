# Drupal styling components

Vocabulary for building Twig components in a Drupal subtheme from Figma designs,
wiring them to content, and verifying them, with Claude Code skills.

## Theme code

**Component**:
A Twig partial and its stylesheet that render only when a bridge template includes
them.
_Avoid_: SDC, pattern (for the parent theme's, say *parent pattern*), component
for the Figma side (say *design frame*)

**Partial**:
The component's Twig file itself.
_Avoid_: partial for a stylesheet (say *stylesheet*)

**Include-only component**:
A component used only inside other components and never placed as content, so it
needs no bridge.
_Also used_: sub-component

**Token**:
A Sass variable or function in the subtheme's base styles that names a design value
(colour, breakpoint, font, `rem()`).
_Avoid_: variable. *Design token* is also used for the same thing.

**Parent theme**:
`example_base`, which the subtheme extends and never edits.
_Avoid_: legacy theme, parent (alone). *Base theme* is Drupal's own term for it.

## Drupal wiring

**Wiring**:
Making a built component render with real content: its bridge template, plus a
preprocess function when referenced entities feed it. *Connect* is the skill and
step that does it; *wire* is the verb.
_Avoid_: hook up

**Bridge template**:
The Drupal template (paragraph, views or block) that maps field data to a
component's props. Short form: *bridge*.
_Avoid_: paragraph template (when the role is meant), wrapper

**Entry point**:
The Drupal render path a bridge hooks into: paragraph, views, block or page
template.
_Avoid_: entry point for the JS bundle (say *bundle entry*)

**Preprocess guard**:
The field-presence and empty checks, with defaults, that let a preprocess function
survive a blank field.
_Avoid_: guard for a Twig conditional (say *conditional*)

**Raw vs rendered**:
A field's stored value versus its rendered output with text filters applied.

**Confirmed field name**:
A field name the user, the admin UI or a working drush has confirmed. Anything else
is a *candidate*.
_Avoid_: assumed, guessed (for a name used in a template)

**Spec mode**:
Connect's behaviour when the paragraph type or its fields cannot be confirmed:
report the fields the component needs instead of writing a bridge.

## Design side

**Design**:
The Figma file as the authority on what a component should be.
_Avoid_: comp. *Mockup* is also used.

**Figma node**:
The design frame a component is built from and verified against. Always say
*Figma node*; a *Drupal node* is a content entity.

**Bound variable**:
A Figma variable attached to a property in the design; the value verification
compares against.
_Avoid_: variable definition, design token

**Variant**:
A mode of a design frame (light, dark, with or without a background graphic).
_Avoid_: variant for a code alternative (say *version*) or a layout (say
*4-up layout*)

**Node registry**:
The record of Figma nodes that resolved in real verification runs. Always
qualified; Drupal's *theme registry* is unrelated.

## Review and verification

**Reuse pass**:
The search over existing components and the parent theme before new code is
written, repeated by review.
_Avoid_: reuse-first pass. *Discovery pass* is also used.

**Observation**:
Something noted for a person to judge, not a failure.

**Divergence**:
A measured difference between the rendered component and the design, before any
filter is applied.

**Smell**:
A code shape that produces a finding.

**Finding**:
A divergence or smell that survived the filters and is sorted into a tier.
_Avoid_: issue

**Defect**:
A finding that is this component's to fix (`✗`). A finding that is real but
theme-wide or inherited is *theme-level* (`⚠`).
_Avoid_: defect for a bug in a skill (say *bug*)

**Unverified**:
Not checked by any run: a variant absent from the page, a breakpoint skipped, a
design source unavailable (`?`). A verdict with any unverified check is
*PASS (partial)*.

**Tier 1**:
A fix that cannot move anything on the page; applied in place.
**Tier 2**:
A fix that can change layout flow or what other files target; proposed, then
waited on.
_Avoid_: safe, mechanical

**Trap**:
A step that looks finished and is silently wrong (poster-image trap,
obvious-comment trap, pixel-diff trap).

## Process

**Workflow** (or *chain*):
The sequence figma-component → component-review → connect → design-verify. Build
and review chain automatically; the rest are opt-in.
_Avoid_: pipeline

**Opt-in**:
A skill that runs only when the user asks; it is offered, never chained into.
_Avoid_: manual

**Side door**:
A skill entered directly rather than through the workflow: fix-component,
video-modal.

**Skill**, **Reference file**, **Eval**, **BCP / ADR / RFC / NFR**:
As README's glossary and the docs index define them.

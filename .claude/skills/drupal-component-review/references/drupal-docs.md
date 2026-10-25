# Drupal documentation standards for example_subtheme

The canonical comment format for every file type in this theme. Existing
components predate this and use an ad-hoc style — **match this document, not the
neighbouring file.** When you touch a file whose docblock uses the old style,
convert that docblock as part of the change.

Reference: Drupal API documentation and comment standards. `drupal/coder` is
already a composer dependency, so the PHP rules here are machine-checkable.

## Twig templates

Drupal core wraps a **PHP-style docblock inside a Twig comment**. The `{#` and
`#}` sit on their own lines and the block inside is a normal `/** */` docblock.

```twig
{#
/**
 * @file
 * Renders a row of icon link tiles inside a tinted panel.
 *
 * Available variables:
 * - title: Section heading. Required.
 * - description: Optional intro text.
 * - items: Link tiles, each with the following keys:
 *   - icon: Icon font class, e.g. "icon-account-group-4".
 *   - title: Tile label.
 *   - url: Destination. Omit for an unlinked tile.
 */
#}
```

Rules:

- `@file` on its own line, description on the next. One-line summary ending in a
  period, written in the third person ("Renders a…", not "Render a…").
- The variable list is headed **`Available variables:`** — this is the phrase
  core uses, not `Parameters:`.
- Each entry is `- name: Description.` Sentences end with a period.
- Nested keys indent by two spaces under their parent, as `items` does above.
- Mark optional variables with a leading `(optional)` — core's convention:
  `- description: (optional) Intro text.`
- Wrap at 80 characters. Continuation lines align under the description text.
- **No decorative rules** (`─────`, `=====`), no em-dash-separated type columns,
  no `(string|null)` type annotations. Twig is untyped; describe the value and
  its constraint in prose instead.

Inline Twig comments use plain `{# … #}` and follow the same why-not-what rule as
every other comment in this repo.

## PHP (`example_subtheme.theme`)

`@file` block at the top of the file, one blank line after `<?php`:

```php
<?php

/**
 * @file
 * Subtheme theme functions and hooks.
 */
```

Every function gets a docblock. For a hook implementation the **entire summary
is the `Implements` line** — Drupal standard is that this line stands alone,
with no other text, and ends with a period:

```php
/**
 * Implements hook_preprocess_HOOK() for paragraph templates.
 */
function example_subtheme_preprocess_paragraph__quick_links(array &$variables): void {
```

- Use the generic hook name with the `for … templates` suffix. Writing
  `hook_preprocess_paragraph__quick_links()` names a hook that does not exist.
- If the function needs explanation beyond the hook line — and the sandbox
  workaround does — add it as a separate paragraph after a blank line:

```php
/**
 * Implements hook_preprocess_HOOK() for paragraph templates.
 *
 * Flattens referenced quick_link_item paragraphs into a plain array because the
 * Twig sandbox blocks referencedEntities() from templates.
 */
```

- Non-hook helper functions take a normal summary plus `@param` / `@return` with
  types. A `@param` that only restates the type and name adds nothing — but in
  PHP, unlike TypeScript, Drupal standards require the tag to be present, so
  write one that carries information.
- Keep the `/** @var \Drupal\paragraphs\Entity\Paragraph $paragraph */`
  annotations — they are what gives the IDE and static analysis the entity type.

## SCSS

Drupal's CSS standards use a `/* */` file docblock, not `//`:

```scss
/**
 * @file
 * Quick Links component.
 *
 * Tinted panel holding a heading, intro copy, and a row of icon link tiles.
 */

@use '../base' as *;
```

The second paragraph is optional — include it only when the component has
behaviour worth stating (layout strategy, a browser workaround). A restatement
of the component name is noise; drop it.

Section and rule comments inside the file stay `//` (Sass-only, stripped from
output) and follow the why-not-what rule:

```scss
// Bleeds off the top of the panel, so overflow is clipped by the parent.
&__pattern {
```

The trap is a comment that *looks* like a why-comment but only narrates values
the rules below it already show — that's still a what-comment, just in prose:

```scss
// ❌ Restates the media query and grid-template-columns values below it.
// 3-column grid on desktop; mobile stacks one per row.
&__quick-links {
  display: grid;
  grid-template-columns: 1fr;

  @media (min-width: #{$desktop}) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

Delete a comment like that — don't rewrite it into a shorter version that
still just names the technique the code already shows (e.g. "a fixed count,
not auto-fit" is still describing what `repeat(3, ...)` says on the next
line). Default to no comment. The only thing worth keeping *is* a genuine
why — something the declarations can't say for themselves, such as a browser
quirk or a value forced by a constraint outside this file (e.g. matching a
design spec's exact tile count) — and even then, only if it's not obvious
from context already.

## What does not change

The repo-wide comment rules still apply on top of this format. A docblock in
correct Drupal syntax that restates the code is still a bad comment. `@file`
descriptions and variable lists earn their place because they describe a
template's contract, which the markup does not state — that is the exception,
not a licence to annotate every line.

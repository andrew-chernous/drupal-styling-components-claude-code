---
name: drupal-connect
description: Wire an existing @example Twig component into Drupal — write the paragraph, views, or block bridge template plus any preprocess for referenced entities, or, when the paragraph type does not exist yet, report the fields the component needs. Use when the user asks to connect a component to a paragraph type, view, or block, asks which Drupal fields a component needs, or asks why a built component renders nowhere.
---

# Component → Drupal Wiring

Third step of the component cycle: `drupal-figma-component` builds the partial,
`drupal-component-review` cleans it, this skill connects it to content.

A component in `components/` is **inert until some template includes it.** There is
no SDC, no auto-discovery, no `*.component.yml`. This skill writes the bridge.

## Step 1 — Read the component's contract

Read `components/<name>/<name>.twig` and take the prop list from its docblock.
That list is the spec: every prop is something Drupal must supply, and nothing
else needs to be gathered.

Confirm it is not already wired:

```bash
cd web/themes/custom/example_subtheme
rg -n "@example/<name>/" templates/ components/
```

Hits in `templates/` mean it is already connected — stop and report that. Hits
only in `components/` mean it is include-only (like `section-header`, `modal`,
`_cta-list`) and may not need Drupal wiring at all.

## Step 1b — Does the Drupal side exist yet?

Components here are often built from Figma before anyone models the content, so
check before assuming there is something to bind to. Ask plainly: does the
paragraph type exist, with its fields?

If it does not, **do not write a speculative bridge template.** A file full of
guessed field names looks finished, renders nothing, and fails silently — the
worst combination to hand someone. Switch to spec mode instead: report what the
content model needs, derived from the component's prop list.

```markdown
## Drupal fields needed for `quick-links`

Paragraph type: `quick_links`
- `field_title` (plain text) → title
- `field_body_plain` (long text) → description
- `field_quick_link_item` (entity reference, paragraphs, multi-value) → items

Child paragraph type: `quick_link_item`
- `field_icon_class` (plain text) → tile icon class
- `field_title` (plain text) → tile label
- `field_link` (link) → tile destination
```

Suggest field names that already exist in this theme where the shape matches —
reusing `field_title` is cheaper for editors than inventing `field_qlink_heading`,
and keeps future bridges predictable. Point the user at
`/admin/structure/paragraphs_type/add`, and say that once the fields exist,
re-running this skill will write the bridge in one pass.

That report *is* the deliverable in this mode. Stop there.

## Step 2 — Ask the user (do not guess)

Field names cannot be derived from the code — they live in a database this skill
cannot read. Ask, in one round of questions where possible.

### a. Entry point

Which template type should render it:

| Entry point | Bridge file | Use when |
|---|---|---|
| **Paragraph** | `templates/paragraphs/paragraph--<type>.html.twig` | editor places it in a page's paragraph field — the common case |
| **Views** | `templates/views/views-view--<view>--<display>.html.twig` | it renders a list of nodes (see `course-list`) |
| **Block** | `templates/block/block--<id>.html.twig` | it is placed in a region as a block |
| **Page layout** | edit `templates/layout/page.html.twig` | site-wide furniture like header/footer |

For paragraphs, also ask the **machine name** of the paragraph type — the template
filename depends on it, and underscores become the suffix
(`icon_text` → `paragraph--icon-text.html.twig`, hyphens in the filename).

### b. Field mapping

For each prop in the docblock, ask which field feeds it. `references/field-patterns.md`
lists the field names this theme already reuses — offer those as candidates so the
user can confirm or correct rather than recall from scratch.

Present them as suggestions, not facts. If the user does not know, use Step 3.

### c. Repeating items

If a prop is an array of child objects, ask whether it comes from a **paragraph
reference field** (needs a preprocess function, Step 5) or a **plain multi-value
field** (loop in Twig is enough).

## Step 3 — When the field names are unknown

Do not stall. In order:

1. **Try drush anyway** — it may work on another machine:
   ```bash
   fin drush field:info paragraph <type> --format=table
   ```
2. **Look for a sibling** — a paragraph type with the same shape already wired.
   Its names are candidates to confirm, not confirmation:
   ```bash
   rg -l 'field_' templates/paragraphs/
   ```
3. **Ask the user to read the admin UI** — offer the exact path:
   `/admin/structure/paragraphs_type/<type>/fields`. Suggest they paste the table.
4. **Still unconfirmed? Stop and deliver the field spec** in the Step 1b format,
   marking which names are confirmed and which are candidates to check.

CLAUDE.md's field-name rule governs: no unconfirmed name goes into a template.

## Step 4 — Write the bridge template

Keep it thin: gather, then `include ... only`. All logic that is not data-shaping
belongs in the component.

```twig
{#
Subtheme override: paragraph--<type>.html.twig
Feeds Drupal field data into @example/<name>/<name>.twig.
#}

<div {{ attributes }}>
  {% include '@example/<name>/<name>.twig' with {
    title: paragraph.field_title.value,
    description: content.field_body_wysiwyg|field_value,
  } only %}
</div>
```

Two things every bridge gets right:

- **Keep `<div {{ attributes }}>` as the wrapper**, and **end the include with
  `only`.** The first carries Drupal's contextual links and cache metadata; the
  second keeps ambient variables from leaking in, so the component's inputs stay
  exactly what its docblock says.
- **Raw vs rendered is the decision to get right.** `paragraph.field_x.value` gives
  the raw stored value — use it for plain text and anything tested in a condition.
  `content.field_x|field_value` gives the rendered output — use it for rich text so
  CKEditor markup and the text format's filters survive. Reading rich text raw
  skips that filtering.

**Read `references/field-patterns.md`** for the rest: CTA arrays, multi-value
children paired by `loop.index0`, variant derivation, fallback chains, and the
preprocess recipes — all taken from the bridges already in this theme.

**Reuse check:** if an existing component already matches the design, point the new
paragraph type at it instead of building another — `paragraph--page-follow.html.twig`
reuses `@example/hero-banner/hero-banner.twig` with a different link field. A second
bridge template is much cheaper than a second component.

## Step 5 — Preprocess, only when required

Needed when the component's items come from **referenced entities** — the Twig
sandbox blocks `referencedEntities()`. Not needed for single-value fields.

Add it to `example_subtheme.theme`, modelled on
`example_subtheme_preprocess_paragraph__stats()`. **The full recipe — including link
and media unwrapping — is in `references/field-patterns.md`.**

**Shape the array to the component, not to the sibling you copied.** A sibling
preprocess is the right starting point, but its item shape belongs to *its*
component. `icon_text` builds `link` as a `{url, title}` object; a component whose
tile partial expects a flat `url` string gets a link that silently never renders —
nothing errors, the markup is just wrong. Re-read the component's docblock and
match its prop types before adapting a sibling.

What matters regardless of the shape:

- Guard with `hasField()` + `isEmpty()` and default every value with `?? ''`.
  Editors leave fields blank, and an unguarded `->value` turns a blank field into
  a fatal error on a page that worked yesterday.
- Type-check referenced entities with `instanceof` before using them.
- The docblock summary is `Implements hook_preprocess_HOOK() for paragraph
  templates.` on its own, with the sandbox rationale as a second paragraph.
  `drupal/coder` enforces this; see
  `../drupal-component-review/references/drupal-docs.md`.
- Flatten to plain arrays — passing entity objects into the component couples it
  to Drupal and re-introduces the sandbox problem one level down.
- Reuse the imports already at the top of the file.
- Note the variable in the template so the indirection is visible to whoever reads
  it next: `{# <name>_items is built in example_subtheme_preprocess_paragraph__<type>() #}`

## Step 6 — Verify

```bash
fin drush cr    # theme registry must be rebuilt before a new template resolves
```

A new template file or preprocess function **does not take effect until cache
clear.** If `drush cr` fails in this environment, say so and tell the user to
clear caches at `/admin/config/development/performance`.

Then confirm on a page that actually uses the paragraph type. The `run` skill
covers launching the site. Check:

- The component renders with real content, not empty markup.
- Optional fields left blank degrade gracefully rather than printing empty elements.
- Rich text keeps its formatting (the `|field_value` path).

## Report

If you stopped at Step 1b, the report is the field spec — say clearly that no files
were written and why, so nobody goes looking for a template that is not there.

Otherwise:

- [ ] Entry point and machine name confirmed with the user.
- [ ] Every component prop mapped to a confirmed field.
- [ ] Bridge template written; `{{ attributes }}` kept, include ends in `only`.
- [ ] Preprocess added only if referenced entities are involved.
- [ ] Caches cleared; component verified rendering with real content.

List the files created or edited, and **name the source that confirmed each field
name** (user, admin UI, or drush).

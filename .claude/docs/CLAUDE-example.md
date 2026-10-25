> The CLAUDE.md that ran in the original project, unchanged apart from the renamed
> identifiers and two cut paragraphs (skill chain, font facts; both have other homes).
> Nothing in it applies to this repo. It is here because the skills' "CLAUDE.md"
> pointers mean this file once it sits in a project root: copy it there, delete
> this note, and trim it to the constraints that are true for your theme.

# Example Project — Drupal Custom Upstream

Drupal 11 pseudo multi-site (Pantheon / Custom Upstream), dev on Docksal. Active
front-end work: the 2026 reskin in web/themes/custom/example_subtheme.

## Commands (via fin)

- Setup: `fin init --site={site_name}` (plain `fin init` is NOT enough)
- Drush: `fin drush cr`, status: `fin drush --uri=example.docksal status`
- Lint PHP: `fin exec 'php -l <path>'`
- Theme (from web/themes/custom/example_subtheme, `nvm use` Node 20):
  `npm run watch` · `build` · `lint:scss` / `lint:js` · `build:scss` / `build:js`

## Hard constraints — read before touching fields/context

- **Drush can't bootstrap the DB locally** (MariaDB TLS mismatch). No field:info /
  php:eval / sql:query. `fin drush cr` works.
- **Field config is NOT in git** — every field_* lives in the DB, made via the admin
  UI. Nothing in the repo reveals a name/type.
- ⟹ **Field-name rule** (the skills point here): a field name is usable only
  once the user, `/admin/structure/paragraphs_type/<type>/fields`, or a working
  `drush field:info` confirms it. Sibling bridges and field-patterns.md give
  candidates to confirm, not names to write. Unconfirmed → write no bridge;
  deliver the field spec (drupal-connect Step 1b) and stop.
  **Never guess a field name — a wrong one renders empty with no error.**
- Local use `--uri=example.docksal`, NOT drush aliases (`@example`, `@example_base`,
  `@live` point at remote Pantheon, need SSH key).

## example_subtheme — component & context rules

Child of example_base (`base theme: example_base`). **Never edit web/themes/custom/example_base/** (shared) —
override from the subtheme.

- **Components are plain Twig partials, NOT SDC. Do not create `*.component.yml`.**
  info.yml maps `example` → components, so `@example/foo/foo.twig` →
  components/foo/foo.twig. No auto-discovery — a component renders only when
  included. Entry points: `templates/paragraphs/paragraph--<type>.html.twig`
  (common), views/block templates, layouts/page.html.twig.
- **Context in Drupal (the part that actually burns time):**
  - Twig sandbox blocks `referencedEntities()`. Components fed by referenced
    paragraphs/media need a preprocess fn in example_subtheme.theme that flattens
    entities to plain arrays. Single-value fields need none.
  - Raw vs rendered: `field_x.value` = raw stored value (plain text + conditions);
    `content.field_x|field_value` = rendered output (rich text — keeps CKEditor
    markup + filters).
  - Bridge templates keep `<div {{ attributes }}>` (contextual links, cache,
    quickedit). Every include ends in `only`.
- **SCSS must be registered**: add to scss/_styles-main.scss or it does nothing.
  One global css/styles.css at weight 100 beats the parent — `!important` vs example_base
  is almost always wrong.
- **Tokens**: use scss/base/ tokens (`rem()`, `focus-ring()` mixin). Don't hardcode
  a value that exists as a token.
- **SCSS comments**: default to none. Only add a `//` line for something the
  declarations genuinely can't say for themselves (a browser quirk, a Drupal
  markup-nesting workaround, a value forced by an external constraint) — never
  one that narrates the property/value pairs already on the lines below it,
  even in a shorter paraphrase. Seeing an obvious one while editing nearby?
  Delete it, don't reword it.

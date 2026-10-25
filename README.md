# Drupal styling components with Claude Code

A set of Claude Code skills built and used on a production Drupal 11 theme to
take components from a Figma design to a rendering, design-verified Drupal
paragraph. This repo is the `.claude/` folder of that project with the client
identifiers replaced by a fictional theme (`example_subtheme`, Twig namespace
`@example`, parent theme `example_base`). Everything else is as it ran.

It is published as an example of one way to work with agent skills: one skill per
stage of a real workflow, each handing off to the next. It is written for a
Drupal or front-end developer who wants to build skills for their own project;
the pattern transfers to other stacks.

**What this is not.** It is not runnable here: the theme the skills work on is
not in the repo. It is not a Drupal tutorial. And it is not an eval framework:
one skill has a small eval set, kept as the experiment it was.

## The problem the skills solve

The theme had a few traits that made every component a repeat of the same
careful steps:

- Components are plain Twig partials, not Single Directory Components. Nothing
  renders until a bridge template includes it, and a bridge pointing at a wrong
  field name renders empty with no error.
- Field configuration lived in the database, not in git, and drush could not
  bootstrap the database locally. Field names had to be confirmed in the admin
  UI or by asking, never guessed.
- The parent theme, which must not be edited, sits under the subtheme in the
  cascade, so the first instinct (`!important`) is almost always wrong.
- The Twig sandbox blocks `referencedEntities()`, so any component fed by
  referenced paragraphs or media needs a preprocess function first.

Each skill encodes one stage of that process, so a new session does not have to
rediscover the traps.

## The workflow

```
Figma design
    │
    ▼
/drupal-figma-component ──────► components/<name>/<name>.twig + scss/components/_<name>.scss
    │                           reuse pass over existing @example partials and the parent theme first
    ▼
/drupal-component-review ─────► reuse, tokens, docblocks, SCSS complexity; fixes applied in place
    │
    │  stops here and offers the next step
    ▼
/drupal-connect (opt-in) ─────► templates/paragraphs/paragraph--<type>.html.twig
    │                           preprocess function when referenced entities are involved
    ▼
/drupal-design-verify (opt-in) ► computed styles of the rendered page vs the design's bound Figma variables
                                report; tier-1 fixes on request; what was not verified is marked

/drupal-fix-component          ► separate path: one reported bug, diagnosed and fixed, no full audit
/drupal-video-modal            ► separate path: open a component's media in the shared <dialog> modal
```

| Skill | What it does |
|---|---|
| [`drupal-figma-component`](.claude/skills/drupal-figma-component/SKILL.md) | Builds a Twig partial and SCSS from a Figma node via the Figma MCP tools, after a mandatory reuse pass. A new component that duplicates an existing one is treated as a defect. Start here. |
| [`drupal-component-review`](.claude/skills/drupal-component-review/SKILL.md) | Second pass once the code exists: existing patterns reused, no value hardcoded when a token exists, Drupal docblock standards, no more SCSS than the design needs. Fixes rather than reports, then offers wiring. |
| [`drupal-connect`](.claude/skills/drupal-connect/SKILL.md) | Writes the paragraph, views, or block bridge template and any preprocess function. Opt-in, because the Drupal side often does not exist yet. |
| [`drupal-design-verify`](.claude/skills/drupal-design-verify/SKILL.md) | Extracts computed styles from the rendered page with Playwright and compares them to the design's variable definitions and the theme's tokens. Values, never a pixel diff. |
| [`drupal-fix-component`](.claude/skills/drupal-fix-component/SKILL.md) | A targeted repair for a reported symptom in style, JS, or Drupal wiring. Deliberately not an audit. |
| [`drupal-video-modal`](.claude/skills/drupal-video-modal/SKILL.md) | Extends the existing modal infrastructure to a new component instead of building another lightbox, and handles the poster-image trap of rendered video fields. |

The two separate paths show the second use of a project skill. The workflow
skills encode a process; `drupal-video-modal` encodes a custom solution to a trap
that kept recurring (a rendered video field playing inline instead of showing a
poster), so the next component gets the fix instead of the bug.

Two files under `.claude/skills/shared/` serve more than one skill.
`tokens.sh` derives the design tokens from the theme's SCSS at run time: two
skills needed the palette in different shapes, and both had drifted from the Sass
when each kept its own copy. `fix-tiers.md` is the one definition of which fixes
review and verification apply in place and which they propose.

## Design decisions

- **Reuse before create.** Most of the build skill is the reuse pass that
  happens before any code is written. The review skill repeats it after, because
  the first pass runs before the design is fully understood.
- **Wiring is opt-in.** A bridge to fields that do not exist fails silently, so
  the workflow stops after review and waits to be asked.
- **Verification compares values, not pixels.** A pixel diff reports the layout
  shift caused by real content and misses a wrong font family. Computed styles
  against bound Figma variables catch the second and ignore the first.
  ([ADR-002](.claude/docs/ADR-002-values-not-pixels.md))
- **The facts that go stale live in `references/`.** Token inventories, field
  patterns and the Figma node registry sit outside the skill body, in one known
  place to revise when the environment changes.
- **Project instructions stay in `CLAUDE.md`.** The hard constraints above and the
  rules every skill relies on are in the project's `CLAUDE.md` (template:
  [`.claude/docs/CLAUDE-example.md`](.claude/docs/CLAUDE-example.md)), so they hold
  in sessions that never invoke a skill.
- **Docs have types.** [`.claude/docs/`](.claude/docs/README.md) separates living
  practice (BCP) from immutable decisions (ADR) and open proposals (RFC).

## Testing a skill

`drupal-design-verify` was run with and without itself on three prompts from real
requests and graded by a regex grader. The runs found two bugs in the skill, and
showed that its value was consistency across runs rather than a higher average.
It is an experiment kept as-is, not the point of the repo; the recipe is in
[BCP-002](.claude/docs/BCP-002-skill-evals.md) and the prompts and grader under
[`evals/`](.claude/skills/drupal-design-verify/evals/).

## Writing your own

1. **Pick one stage** of your own workflow that keeps repeating the same careful
   steps. One skill per stage; let it hand off to the next.
2. **Write the description first**, with one trigger per case it handles, and test
   that it fires on real prompts and stays quiet on near-misses.
3. **Put the facts that go stale in `references/`** and keep the body to the steps
   and the reasons behind them.
4. **End with the hand-off sentence**: what is done, what is not, and which skill or
   decision comes next. `drupal-component-review`'s report is the model.

To reuse these skills as they are: copy `.claude/` into your project root, rename
`example_subtheme` / `@example` / `example_base` (also in `shared/tokens.sh` and
`scripts/extract-styles.js`), rewrite the `references/` files against your theme,
and copy [`CLAUDE-example.md`](.claude/docs/CLAUDE-example.md) to your project root
as `CLAUDE.md`. The Figma skills need the Figma MCP server; design verification
also needs the Playwright MCP server and a local site that renders the component.

## Glossary

The full vocabulary is in [`CONTEXT.md`](CONTEXT.md). Five terms to start with:

- **Component**: a Twig partial and its stylesheet that render only when a bridge
  template includes them.
- **Bridge template**: the Drupal template (paragraph, views or block) that maps
  field data to a component's props.
- **Token**: a Sass variable or function in the subtheme's base styles that names a
  design value.
- **Opt-in**: a skill that runs only when you ask; it is offered, never chained
  into.
- **Eval**: one realistic prompt plus assertions, run with and without the skill.

## Licence

MIT. See [LICENSE](LICENSE).

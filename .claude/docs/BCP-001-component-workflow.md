# BCP-001 — Building Components: Figma → Drupal

**Status:** Current
**Applies to:** `web/themes/custom/example_subtheme`
**Last reviewed:** 2026-10-25

A *Best Current Practice* describes the recommended way to do a recurring task
given what is true about the environment today. Parts of this document depend on
conditions that will change — notably that drush cannot reach the database and
that field config lives outside the repo. When those change, revise this file.
That is the difference between a BCP and an ADR: an ADR records a decision and is
superseded, a BCP records a practice and is edited.

---

## Contents

1. [The six skills](#the-six-skills)
2. [Why wiring is opt-in](#why-wiring-is-opt-in)
3. [When Drupal is not ready](#when-drupal-is-not-ready)
4. [Why verification compares values, not pixels](#why-verification-compares-values-not-pixels)
5. [Environment constraints](#environment-constraints)
6. [Architecture you need to know](#architecture-you-need-to-know)
7. [Worked example: quick-links](#worked-example-quick-links)
8. [Worked example: verifying the 50-50](#worked-example-verifying-the-50-50)
9. [Worked example: the obvious-comment trap](#worked-example-the-obvious-comment-trap)
10. [Maintaining the skills](#maintaining-the-skills)

---

## The six skills

They live in `.claude/skills/` and are invoked with a slash command or by asking
in plain language. README's skill table and chain diagram show what each one does.
Build and review chain automatically; wiring (`drupal-connect`) and verification
(`drupal-design-verify`) run only when you ask.

`drupal-design-verify` is the only skill that looks at what a browser actually
paints. That is why it comes last, and why it catches a different class of defect
than `drupal-component-review`, which cannot see the cascade.

`drupal-fix-component` sits outside that build chain. It doesn't run automatically
after anything — it triggers when you point at a specific symptom on a component
that's already shipped ("the modal doesn't close", "quick-links wraps wrong on
mobile"). It diagnoses across whichever layer the symptom implicates (SCSS, JS,
bridge template, preprocess) and stops once that's fixed — it deliberately does
not do `drupal-component-review`'s full reuse/tokens/complexity sweep, even though
it applies the same Drupal-standards rules (tokens over hardcoded values, never
guess a field name, keep `{{ attributes }}` + `only`).

`drupal-video-modal` also sits outside the chain: when you ask for a component's
media to open in a modal, it extends the theme's existing video modal instead of building a
new lightbox.

Most skills have a `references/` directory holding detail loaded only when needed —
the token inventory for the review skill, the field-mapping patterns for the connect
skill (`drupal-figma-component` uses the review skill's). Keeping those out of the
main file is deliberate: the skill body stays short enough to read, and the
reference is there when the task actually needs it.

## Why wiring is opt-in

The first two steps only touch theme files. The third binds to a content model
that frequently does not exist yet, because the front end is usually built before
anyone creates the paragraph type.

A bridge template written against fields that do not exist **fails silently**. The
page renders, the component appears, every field is empty, and nothing logs an
error. That is worse than having no file: it looks finished. So `drupal-connect`
waits to be asked rather than running on the assumption that Drupal is ready.

After a build, expect the review skill to end with something like:

> `quick-links` is built and reviewed, but nothing includes it yet, so it renders
> nowhere. When the paragraph type and fields exist, run `/drupal-connect`.

If the fields already exist, say so and it proceeds immediately.

Verification is opt-in for a related reason: it needs the component **actually
rendering on a page**, which is only true after wiring plus real content. Run
against a page where the component is absent and the honest answer is "unverified"
— useful to know, but not what you asked for. It also needs a Figma node URL, which
only you can supply (see below).

## When Drupal is not ready

Run `/drupal-connect` anyway. It detects the situation and switches to **spec
mode**: instead of writing files, it reports the content model the component needs,
derived from the props in its docblock. Take that to
`/admin/structure/paragraphs_type/add`, build the type, then re-run the skill and it
writes the bridge in one pass.

It prefers field names the theme already uses (`field_title`, `field_link`,
`field_body_plain`) where the shape matches. Editors move between paragraph types
constantly; a consistent vocabulary costs nothing and saves them re-learning each
form.

## Why verification compares values, not pixels

Recorded as [ADR-002](ADR-002-values-not-pixels.md): a pixel diff fails on every run
with real content and names no file or line, so `drupal-design-verify` compares
computed styles with the design's bound variables instead. Two rules keep it honest:
total component height is never asserted, and an outlier is a lead, not a verdict.
The 50-50 worked example below is the case that taught the second.

## Environment constraints

These shape the workflow and are the parts of this document most likely to expire.

### Drush cannot bootstrap Drupal

The MariaDB client requires TLS; the container's server does not offer it. This
takes out `field:info`, `php:eval`, and anything else needing a bootstrap.
`fin drush cr` does work.

**Consequence:** field names cannot be discovered programmatically. The skill asks
you instead, and offers names from a similar paragraph type as candidates to
confirm.

**If you fix this** (a PDO/SSL adjustment in `web/sites/default/settings.local.php`),
update `drupal-connect`'s Step 3 — automatic field discovery would remove most
of the asking.

### Field config is not in the repository

`config/` contains only `env` and `sites`. Every `field_*` referenced by a template
lives in the database, created through the admin UI. Nothing in version control can
tell you a paragraph field's name or type. One exception: the `external_news` node
bundle's field config **is** in git (`config/sites/example/field.field.node.external_news.*.yml`),
so for that bundle the files are the authority.

**Consequence:** the only authorities are the admin UI and you. This is why the
skill asks rather than greps, and why an unconfirmed name stops the bridge and
yields a field spec instead (CLAUDE.md, field-name rule).

## Architecture you need to know

The rules are in the project CLAUDE.md ([template](CLAUDE-example.md)). The two that
most surprise newcomers are recorded as decisions: [ADR-001](ADR-001-twig-partials-not-sdc.md)
(plain Twig partials, not SDC) and [ADR-003](ADR-003-global-stylesheet.md) (one global
stylesheet at weight 100).

## Worked example: quick-links

The component was built from Figma, reviewed, and then wired. What the connect
skill asked and produced:

1. **Entry point?** New paragraph type `quick_links`.
2. **Items source?** Referenced child paragraphs → needs preprocess.
3. Wrote `templates/paragraphs/paragraph--quick-links.html.twig`.
4. Added `example_subtheme_preprocess_paragraph__quick_links()` to `example_subtheme.theme`.
5. Verified with `php -l` and `fin drush cr`.

**The trap it exposed.** The obvious model was `icon_text`, which has the same
child shape. But its preprocess builds `link` as a `{url, title}` object, while
`_quick-links-item.twig` takes a flat `url` string. Copying the sibling faithfully
would have produced tiles whose links never rendered — no error, just wrong markup.

The lesson is now in the skill: a sibling preprocess is a starting point, but the
item shape belongs to *its* component. Re-read the target component's docblock and
match its prop types.

> **Note:** the `quick_links` field names above were modelled on `icon_text` and
> are unverified. Check them against `/admin/structure/paragraphs_type/quick_links/fields`
> before relying on them. Under the current field-name rule the skill would have
> stopped at the field spec instead.

## Worked example: verifying the 50-50

The first real run of `drupal-design-verify`, and the reason two of its rules exist.

**What it found.** `.example-split-card__quick-link-title` declared `font-size` with no
`line-height`, so it inherited the body's 26px where the design binds `Heading/xs`
at 32px. Fixed at `_split-card.scss:215`, confirmed in-browser at 24px/32px/600.

The cause generalises: a Figma `Font(…)` composite binds size, line-height, and
weight **together**, so emitting `font-size` alone is silently half-applied. Any
component that sets a heading size without a line-height likely has the same bug.

**The trap it exposed.** The extraction's frequency map showed
`18px/26px 400 Roboto` appearing exactly once against eight `SourceSansPro`
siblings — a textbook outlier, and the skill's own reference file at the time
called `Roboto` on body text "almost always a defect."

It is not. The design binds `Text/Paragraph-m` to Roboto, and nine component
stylesheets set `font-family: $roboto` on their description element. "Fixing" it
would have made split-card the only description in the theme that diverges, and
reported the damage as a correction.

The run caught this only because it checked sibling components before editing.
That check is now a rule in the skill, generalised past fonts: **a value repeated
across the theme is a convention; only a genuinely unique value is a candidate
defect, and even then the design decides.**

**Two theme-level findings** came out of the same run and were open at the time:

- Neither `Roboto` nor `SourceSansProBold` has an `@font-face`. Both silently fall
  back to Helvetica/Arial across ~10 components. Note that
  `document.fonts.check()` returns `true` for them and is not a valid test —
  compare rendered width against a deliberately bogus family instead.
- `$container-superwide` is 1260px against the design's 1280 — a systematic 20px
  delta inherited from `example_base`.

Both are theme-level, so they are reported once at that level rather than patched
inside a component stylesheet.

**A defect neither design frame could show.** The design supplies discrete widths
(1440 / 768 / 320) and the component renders correctly at all three — but between
1024 and 1279px the image column overflows its panel by 108px, because
`flex: 0 0 530px` cannot shrink inside a container locked at 960px. Verification
now tests the width just below each `min-width` query, not only the design's frames.

## Worked example: the obvious-comment trap

`split-card`'s quick-links grid picked up a two-line `//` comment while being
fixed to a 3-column layout:

```scss
// 3-column grid on desktop so 1 or 2 tiles keep their natural width instead
// of stretching full-width; mobile/tablet stack one per row.
&__quick-links {
  display: grid;
  grid-template-columns: 1fr;

  @media (min-width: #{$desktop}) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

It reads as a why-comment, but it isn't one: every fact in it is already visible
in the two declarations below — `1fr` is one column, `repeat(3, 1fr)` is three,
the media query is the desktop breakpoint. The first attempt at a fix rewrote it
shorter (`// Fixed repeat(3, …), not auto-fit: keeps 1–2 tiles at natural
width`), which is the same defect in fewer words — it still just names the
technique the next line already shows. The comment was deleted, not reworded,
and the rule kept was the general one: **when a rewrite of a bad comment is
just a shorter restatement, the correct fix is deletion, not a smaller
paraphrase.**

That rule is now the project CLAUDE.md's SCSS comment rule, which
`drupal-fix-component` points at (Step 4, since a fix is exactly where a comment
like this gets added in passing), and it is in
`drupal-component-review/references/drupal-docs.md` (the SCSS section, since a
review is exactly where an existing one should get caught). A comment earns
its place only by stating something the declarations can't — a browser quirk,
a Drupal markup-nesting workaround, a value forced by a constraint outside the
file. Default to none.

## Maintaining the skills

Skills are prompts, and prompts drift from reality. Two habits keep them honest.

**Test against real work, not synthetic prompts.** The `quick-links` run above
found a defect — the prop-shape mismatch — that a made-up test case would likely
have missed, because the mismatch only existed between two specific real files.

`drupal-design-verify` was built this way and it paid off twice. Its evals ran each
prompt with and without the skill; the runs surfaced that its own reference file
was **wrong** about Roboto, and a later run on an unregistered component caught a
fake node ID left in the registry as a formatting example — an ID a less careful
run could have used as data. Both were defects in the skill, found by exercising
it rather than by reading it.

A caveat learned from those evals: a small test set flatters the skill. Two of
three cases were saturated — the no-skill baseline was already good at refusing to
fabricate — so the headline pass-rate delta was small and mostly meaningless. The
skill's real contribution was **consistency**: both with-skill runs behaved
identically, while baselines varied, one editing SCSS during what was asked as a
read-only QA. Judge a skill on variance across runs, not on a three-case average.

**Edit them when the environment moves.** If drush starts working, if field config
lands in the repo, if the theme adopts SDC — the skills encode those facts and will
confidently apply stale ones. The `references/` files are usually where the
environment-specific detail lives.

---

## Related documents

- [ADR-001](ADR-001-twig-partials-not-sdc.md), [ADR-002](ADR-002-values-not-pixels.md),
  [ADR-003](ADR-003-global-stylesheet.md): the decisions this practice rests on.
- [BCP-002](BCP-002-skill-evals.md): how to evaluate a skill before trusting it,
  including the `skill-creator` loop.
- [CLAUDE-example.md](CLAUDE-example.md): the project instructions the skills rely on.

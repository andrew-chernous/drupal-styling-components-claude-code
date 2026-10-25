---
name: drupal-design-verify
description: Verify a rendered component against its Figma design — computed styles from the page compared to the design's bound variables and the theme tokens, values never pixels. Use when the user asks to verify, QA, or compare a built component against Figma or the mockup, or reports that something looks off compared to Figma and gives the node URL. Opt-in — needs the component rendering on a page and a Figma node URL, so wait for the user to ask rather than chaining it after a build. Applies safe token-level fixes when asked for fixes, and a plain check only reports; a visual bug reported with no design reference is drupal-fix-component.
compatibility: Needs the Figma MCP server, the Playwright MCP server, and a local site that renders the component.
---

# Design Verify

Third pass in the component workflow. `drupal-figma-component` builds,
`drupal-component-review` audits the code against theme conventions, and this skill
checks the *rendered result* against the *design* — the only step that looks at
what a browser actually paints.

**Core rule: compare values, not pixels.** Everything below follows from that; the
next section explains why, because a verification approach that gets this wrong is
worse than none at all.

## Why not screenshot diffing

The obvious approach — screenshot Figma, screenshot the page, diff the images — is
the one to avoid, for a sharper reason than "web rendering differs from Figma."

The content differs too. Real Drupal content is never the placeholder copy in the
mockup, so a pixel diff reports failure on *every* run for reasons nobody cares
about. The usual response is to raise the tolerance until it stops crying wolf,
and by then it is blind to the defects worth catching. A component that is
perfectly correct and one with the wrong body font both produce the same useless
signal: "some pixels moved."

Worse, a pixel diff is unfixable and unlearnable. "12% of pixels differ" points at
no file and no line, so nothing can be corrected from it and no rule can be derived
to prevent it next time.

Comparing *values* inverts all of this. `font-family: Roboto where the design says
SourceSansPro` names a file, a line, and a fix — and can become a rule that stops
the next component repeating it. That is what makes this loop improve rather than
just alarm.

Screenshots still earn a place, but as evidence for human judgment at the end —
never as the pass/fail gate. See Step 6.

## What you need before starting

1. **A Figma node URL** for the component (`…/design/<fileKey>/…?node-id=1-2`).
   Required — without it there is no authority on what the design specifies, and
   the audit degrades into guessing from a picture.

   Resolve it in this order:

   1. The URL the user gave you in this conversation.
   2. `references/figma-nodes.md` — node IDs recorded from previous verified
      runs. Use an entry only when its component name matches the one you are
      verifying.
   3. **Ask.** "Paste the Figma node URL for `<component>` — *Copy link to
      selection* on the component frame."

   Do not try to discover the node yourself. `search_design_system` searches
   *subscribed libraries*, not this file's canvas — asking it for a component returns components from unrelated org libraries, which is worse
   than nothing because the results look plausible. `get_metadata` without a
   nodeId lists only the page currently open in the desktop app. There is no
   reliable programmatic path from a component name to its node, so a node you
   did not get from the user or the registry is a guess, and a wrong node
   produces confident findings against the wrong design.
2. **A page URL** that renders the component. Ask for it unless the user already
   gave one.
3. **The component's root class**, e.g. `.example-split-card`. Derive it from
   `components/<name>/<name>.twig` rather than asking.

Figma tools need the Figma desktop app open on the file. If they fail, say so and
stop — do not fall back to eyeballing screenshots and present it as verification.

## Step 1 — Read the design

```
mcp__plugin_figma_figma__get_metadata(fileKey, nodeId)       # structure first
mcp__plugin_figma_figma__get_variable_defs(fileKey, nodeId)  # the authority
mcp__plugin_figma_figma__get_screenshot(fileKey, nodeId)     # for Step 6
```

**Call `get_metadata` first.** A component node is usually a wrapper holding one
child frame per breakpoint, and their widths tell you which viewports to test
rather than assuming the usual three. Example from the original project; your IDs
and widths will differ:

```xml
<frame id="253:4083" name="50-50 Component" width="1480" height="4062">
  <symbol id="253:4084" name="Breakpoint=Desktop" width="1440" />
  <symbol id="253:4089" name="Breakpoint=Tablet"  width="768"  />
  <symbol id="253:4094" name="Breakpoint=Mobile"  width="320"  />
</frame>
```

Then call `get_variable_defs` **on the breakpoint child you are verifying**, not
only the parent. A parent returns the union of every variant's variables, so a
value bound only at mobile shows up in the desktop set and reads as a desktop
divergence that is not one.

`get_variable_defs` is the authority: it returns the design's actual bound tokens
rather than your reading of an image. The screenshot is for Step 6 and for what
variables cannot express — which corner is notched, what stacks in which order.

Note the variants the design ships (the 50-50, for instance, has
light-with-pattern, light-without-pattern, and dark). **Each variant needs its own
pass** — a dark-mode bug is invisible while verifying light.

### Confirm the node describes this component

A node that resolves is not automatically the right node. Before reading variables,
check that the design's structure matches what the page renders — one cheap call
that prevents an entire run of confident findings about the wrong design.

`get_metadata` on the component frame names its parts (`.50-50 image`, `Quick Links
Container`, `.title_section`). Compare those against the render:

```js
() => { const r = document.querySelector('ROOT_SELECTOR'); if (!r) return { found: false };
  const kids = (sel) => r.querySelectorAll(sel).length;
  return { hasImage: !!r.querySelector('[class*="__image"]'),
    ctas: kids('.btn'),
    // A tiles wrapper often shares the tile's class stem (`__quick-links` vs
    // `__quick-link`), so count links/articles rather than a substring match.
    tiles: kids('a[class*="__quick-link"], li[class*="__item"]'),
    columns: [...(r.querySelector('[class*="__columns"]')?.children || [])].length }; }
```

Agreement on **image column present, CTA count, tile count, column count** is
enough. On disagreement, **stop and ask** — name the specific mismatch rather than
verifying anyway.

This is not hypothetical. A run was handed node `1225:17812` for `split-card`; it
resolved cleanly, but it is `Quick Links_Card` — a real, separate design with no
image column and no CTAs. Verifying against it would have reported the image, both
buttons, and the column ratio as defects, all with full confidence and all wrong.

If this component was not already in `references/figma-nodes.md`, add it there now
that you have confirmed the node resolves **and matches**.

## Step 2 — Render and extract

```
mcp__plugin_playwright_playwright__browser_navigate(url)
mcp__plugin_playwright_playwright__browser_evaluate(<cache-bust, below>)
mcp__plugin_playwright_playwright__browser_resize(<widest design frame>, 900)
mcp__plugin_playwright_playwright__browser_evaluate(<probe>)
```

**Bust the CSS cache before the first measurement, not after the first fix.**
Drupal serves an aggregated, query-stringed stylesheet, so a fresh page load can
still be styled by CSS built before your last `build:scss`. Every value measured
against it is suspect, and the resulting "defect" points at a file that is already
correct — a false positive that costs several round trips to disprove.

```js
[...document.querySelectorAll('link[rel="stylesheet"]')]
  .filter(l => l.href.includes('example_subtheme') || l.href.includes('css_'))
  .forEach(l => { const u = new URL(l.href); u.searchParams.set('cb', Date.now()); l.href = u.toString(); });
```

Both filters matter: `css_` catches Drupal's aggregate, which is what actually
serves the theme's CSS on a non-dev site. Wait ~1s before extracting. Step 7 runs
this again after applying fixes.

Start at the widest frame width Step 1 reported (1440 for most components, but
read it rather than assuming).

The probe is `scripts/extract-styles.js` — read it, replace `ROOT_SELECTOR` with
the component's root class, and pass the whole arrow function to `browser_evaluate`. It
returns every design-relevant computed value, a `distinct` summary, a `fonts`
load-check, and an `overflow` report — in one call.

It exists so each run does not rewrite the same DOM-walking code. If a run needs
something it does not capture, add the property to `PROPS` in the script rather
than writing a bespoke probe — the next run inherits the improvement.

If it returns `found: false`, the component is not on the page. **Stop and report
that.** Its `hint` field lists the `example-` classes present, which usually shows
whether the selector is wrong or the component is genuinely unwired (in which case
`/drupal-connect` is the missing step). Never let an absent component read as
a pass.

## Step 3 — Token conformance

The highest-value layer, and the one to run first: it is content-independent and
deterministic. Real text length cannot change whether a maroon is `#8C1515`.

Work from `distinct` in the extraction output and
**read `references/computed-to-token.md`** for the computed→token lookup.

- **Every painted color** must map to a token, and to the *same* token the design
  binds. Off-palette is a finding; on-palette but not what the design specifies is
  a bigger one.
- **Every font-size/line-height pair** must sit on the design's type ramp.
- **Every radius and spacing step** must sit on the scale.

`distinct` is a frequency map, which makes outliers visible: scan for the count of
1. But an outlier is a *lead*, not a verdict — and confusing the two is the most
expensive mistake available here.

**Check whether sibling components do the same thing before calling it a defect.**

```bash
rg -n 'font-family|border-radius|<the property>' scss/components/
```

A value repeated across the theme is a convention, however odd it looks in
isolation; only a genuinely unique value is a candidate defect. This is not
hypothetical — the split-card's `Roboto` description reads as a textbook outlier
(one among eight siblings) and is in fact what the design specifies and what nine
other components do. "Fixing" it would have made that component the only one in
the theme that diverges, and reported the damage as a correction.

Two more filters before any finding is real:

- **Is it inherited from `example_base`?** Parent values are worth mentioning but are not
  this component's defect, and overriding them in the subtheme adds CSS that should
  not exist.
- **Is it theme-wide?** A defect present in nine components is one finding about the
  theme, not nine about this component — report it once, at that level, and do not
  edit a component stylesheet to work around it.

### Fonts: check they actually load

A declaration can name the right family and still paint the wrong glyphs, because
the family was never loaded. Comparing `fontFamily` strings cannot see this — the
computed value reports what was *asked for*, not what rendered.

The probe's `fonts` block already answers this: `{ Roboto: false, SourceSansPro:
true, SourceSansProBold: false }`, where `false` means the family is not loaded and
is silently falling back. It measures rendered width against a family that cannot
exist; `document.fonts.check()` would report `true` for all three, because it counts
fallback as paintable.

On this theme both `Roboto` and `SourceSansProBold` fail — theme-wide, reported
once, never fixed inside a component stylesheet. See `references/computed-to-token.md`.

### When a computed value disagrees with the SCSS

Before treating it as a defect, find out which rule actually won. Nine times in ten
the answer is stale CSS, not a wrong value:

```js
() => { const el = document.querySelector('SELECTOR'); const out = [];
  for (const sheet of document.styleSheets) { let rules; try { rules = sheet.cssRules; } catch(e) { continue; }
    const walk = (list, media) => { for (const r of list) {
      if (r.type === 4) { walk(r.cssRules, r.conditionText); continue; }
      if (!r.selectorText) continue;
      try { if (!el.matches(r.selectorText)) continue; } catch(e) { continue; }
      const v = r.style.getPropertyValue('PROPERTY');
      if (v) out.push({ selector: r.selectorText, media: media || null, value: v }); } };
    walk(rules, null); }
  return { computed: getComputedStyle(el).PROPERTY, matched: out }; }
```

If `matched` is missing a rule that exists in `css/styles.css`, the browser is
serving old CSS — re-run the Step 2 cache-bust. **Do not edit the SCSS.**

## Step 4 — Structural invariants

Assert *relationships*, which survive content differences, rather than absolute
pixels, which do not.

Derive the invariants from what the design actually claims. A component named
50-50 claims equal columns; a card with a notched corner claims a specific corner.
Typical shapes:

- Two columns within a few percent of equal width at desktop.
- A row of N tiles is one row at desktop and stacks at mobile.
- The notch/radius is on the corner the design shows.
- The dark variant inverts heading and button colors relative to light.
- Element order top-to-bottom matches the design (compare `box.y`).

**Do not assert on total component height**, and be wary of any single absolute
dimension. Height tracks content length, which differs from the mockup by design;
asserting on it fails every run and trains everyone to ignore the tool. The
design's stated frame height is a *design* figure, not a target.

### Overflow: which measurement counts

**`document.scrollWidth > clientWidth` is the real signal** — it is the only
overflow a user can see. The probe returns it as `overflow.doc`.

`overflow.worst` is the secondary check: children escaping the box meant to hold
them. These are *leads*, not defects.

**Measure against the constraining ancestor, not the component root.** every component roots in a full-bleed `<section>` whose content edge is the viewport edge
— nothing inside can exceed it, so measuring there makes `worst` permanently empty
and the check silently useless. The probe resolves `.container`, then a
`__panel`/`__inner`, then the root, and reports which one it used as
`overflow.measuredAgainst`. **Read that field**: an empty `worst` means "nothing
escaped this box" only if the box was the right one.

Decorative and full-bleed elements are supposed to escape it — `__pattern` draws
the background behind the panel. The probe filters those via `EXPECTED_BLEED`; add
a class there when a component introduces another deliberate bleed, rather than
re-explaining the false positive in every report.

At 320px the split-card reports `measuredAgainst: "container"`, `doc: 0`, and
`worst: []` — with `__pattern` bleeding 20px, correctly suppressed.

## Step 5 — Repeat per breakpoint and variant

Re-run Steps 2–4 at each remaining frame width from Step 1, and once per documented
variant. Most responsive defects live at the breakpoint the developer did not open,
and most variant defects live in the mode nobody looked at.

A design frame drawn at 320 is a *minimum*, not the only mobile width — render at
the theme's own breakpoints too (390 is the useful mobile check) so the comparison
covers real devices rather than only the artboard.

**Also test between the frames.** The design supplies discrete widths; the CSS has
to survive everything in between, and the gap just below a `min-width` query is
where fixed-basis columns break. On the 50-50, both design frames render correctly
while 1024–1279px overflows its panel by 108px — a defect invisible at 1440, 768,
and 320 alike. Check the width just under each `min-width` in the component's SCSS.

Cross-breakpoint checks worth making: text stays inside its container, nothing
overflows horizontally (compare `scrollWidth` to `clientWidth`, and each child's
right edge to its parent's content edge), the stacking order matches the mobile
design, tap targets stay reasonable.

## Step 6 — Screenshot, for judgment only

Now capture the page (`browser_take_screenshot`) and set it beside the Figma
screenshot from Step 1. Use it to catch what assertions cannot express: visual
weight, cramped spacing, an awkward image crop, something that is technically
on-token but looks wrong.

Report these as observations for the user to judge. Do not convert them into
pass/fail — that is the pixel-diff trap arriving by the back door.

## Step 7 — Apply the fixes

Tiers and finding states are defined in `../shared/fix-tiers.md`.

**Edits need a request for fixes.** "Verify", "check", "QA" or "does it match"
asks for a report: list each `✗` as PROPOSED with its tier-1 edit, then offer to
apply them. Apply tier 1 when the request asked for fixes ("fix it", "apply",
"make it match") or the user accepts the offer.

**Tier 1 — apply once fixes are requested.** Typical edits:

- Off-token color → the token the design binds.
- Wrong font-family on a text element → the family the design specifies.
- Font-size, line-height, radius, or spacing → the design's value via `rem()`
  (spacing inside a wrapping row is tier 2).
- A hardcoded value that has a token → the token.

**Tier 2 — propose, then wait.** Typical proposals:

- Flex/grid direction, wrap, or column ratio changes.
- Element order or markup structure.
- Anything touching the Twig, or class names.
- Adding a breakpoint the component does not currently have.

After tier-1 edits:

```bash
cd web/themes/custom/example_subtheme
npm run lint:scss
npm run build:scss
```

Then reload the page and re-extract to confirm the value actually changed. An edit
to SCSS that never reached `css/styles.css` is the most common way a fix looks
applied and is not — `build:scss` is what compiles it.

**A plain reload is not enough.** Re-run the Step 2 cache-bust snippet, wait ~1s,
then re-measure — otherwise the browser keeps the pre-fix CSS and a correct fix
looks like it failed.

If source and compiled CSS both contain the new value but the browser does not, it
is cache — confirm with `rg -o '<selector>\{[^}]*\}' css/styles.css` rather than
"re-fixing" a correct file. `fin drush cr` clears the server-side aggregate.

## Report

Lead with a verdict line, then one status row per check. Every checked thing gets a
glyph so the result is readable at a glance. The values below are from one run on
the original project; copy the shape, not the numbers:

```
DESIGN VERIFY — <component> (<variant>) @ 1440·1100·1023·768·390·320
Design: <node> (<design name>)
VERDICT: PASS (partial) — 14 checks · 0 defects · 2 theme-level · 2 unverified

✓ colors      6/6 map to the tokens the design binds
✓ type        4/4 size/line-height pairs on the ramp
✓ radii       8px buttons + tiles, notch top-right
✓ spacing     panel 48, gaps 32/16, section-padding-y 96
✓ structure   row→column at 1024, order matches, doc overflow 0 at all widths
✗ radius      tile 8px → design 12px       _split-card.scss:186 — FIXED
⚠ fonts       Roboto, SourceSansProBold not loaded — theme-wide, not fixed here
⚠ container   text col 602 vs design 574   .container 1260 vs max_width/7xl 1280
? dark        variant not on page          UNVERIFIED
? pattern-off variant not on page          UNVERIFIED

Observations (judgment, not failures)
  - Tile 3 has no icon; tiles 2 and 3 share a label. Test content, not code.
```

**Four states, and the distinction is the point:**

| | Meaning |
|---|---|
| `✓` | Passes against the design |
| `✗` | Defect **in this component** — fix it, cite `file:line` and FIXED/PROPOSED |
| `⚠` | Real, but not this component's to fix — theme-wide or inherited from `example_base` |
| `?` | Not checked — variant absent, breakpoint skipped, design source unavailable |

Two states would force a lie. "Roboto has no `@font-face`" is not a split-card
failure, and "dark variant not on the page" is neither pass nor fail. Marking those
`✗` makes the report cry wolf; marking them `✓` hides them. Both destroy the trust
that makes the tool worth running.

**`VERDICT: PASS` only when the `?` list is empty.** Otherwise `PASS (partial)` with
the count. A run that verified light and skipped dark verified half a component, and
saying otherwise is how a verification tool starts lying. `FAIL` when any `✗`
remains unfixed or unproposed.

Put the counts on the verdict line so the summary cannot silently disagree with the
rows beneath it.

Close by feeding the result back into the workflow: if a defect came from a
pattern likely to recur (a `$roboto` copied from a form partial, say), say so and
offer to add it as a rule in `drupal-figma-component`. That feedback step is what
makes the next component start closer to correct, rather than catching the same
bug forever.

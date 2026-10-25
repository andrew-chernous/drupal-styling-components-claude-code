---
name: drupal-video-modal
description: Open a component's media in the theme's shared video modal instead of building a new lightbox, and fix the poster-image trap where a rendered video field shows a live player instead of a thumbnail. Use when the user wants a component's image to open a video in a modal, lightbox or popup, or reports a video playing inline, autoplaying, or duplicated on page load instead of sitting behind a play button.
---

# Video-in-Modal Wiring

Adds "click the media, video opens in a modal" to a component that currently
only handles a static image. This infrastructure already exists and is used
by two components (`video_testimonial`, `split-card`) — the job here is to
extend the existing pattern to a third, not invent a new one.

**Core rule: reuse the existing modal, do not build a new one.** Before writing
any code, confirm `components/modal/modal.twig` and `js/components/modal.js`
are still the only modal in the theme (`rg -il "modal" components/ js/`). Also
check `web/themes/custom/example_base` for a competing solution — it has a jQuery
`lightGallery` lightbox (`js/script.js`, `.js-lightbox-gallery`) that looks
tempting but is wired to the photo-gallery component's selector contract, pulls
in jQuery the subtheme otherwise doesn't load, and example_base is off-limits to edit.
It is not a fit for this — the vanilla-JS `Drupal.ExampleModal` in example_subtheme is.

## Architecture facts

- **`components/modal/modal.twig`** — generic `<dialog>` partial. Props:
  `modal_label` (aria-label string), `modifier` (`'video'|'image'`, default
  `'video'`). Include it once per section, gated on the video actually being
  present (`{% if video_url %}`) so cards without video never ship an unused
  `<dialog>`.
- **`js/components/modal.js`** — `Drupal.ExampleModal.open(modalEl, htmlString)`
  injects HTML into `.js-example-modal-content` and calls `.showModal()`;
  `Drupal.ExampleModal.close(modalEl)` calls `.close()`. Drupal.behaviors wires the
  close button, backdrop click, native Escape, and clears content on close (so
  playback actually stops). **Never edit this file** — it is generic and every
  consumer shares it.
- **`js/utils/video-embed.js`** — the shared module every video-opening
  component imports from. Three exports, all reused by both current
  consumers (`testimonials.js`, `split-card.js`):
  - `buildEmbedUrl(watchUrl)` — converts a raw YouTube/`youtu.be`/Vimeo watch
    URL into an autoplay embed URL, with a try/catch fallback that returns
    the URL unchanged for unsupported hosts.
  - `wireVideoModalTriggers(section, triggerSelector)` — finds
    `.js-example-modal` inside `section`, and wires every element matching
    `triggerSelector` to build the embed URL and call
    `Drupal.ExampleModal.open()` on click. Handles both a single trigger (e.g.
    split-card's one play button) and many triggers sharing one modal (e.g.
    testimonials — several video cards, one dialog per section). **This is
    the function a new component's JS behavior should call — do not hand-roll
    the click/iframe-building logic again.**
  - `closeVideoModal(section)` — closes `section`'s modal if open; call from
    `detach()` on unload.
  Read the full source in
  `../../../web/themes/custom/example_subtheme/js/utils/video-embed.js` before
  assuming its host coverage; extend it there (not per-component) if a new
  video host needs support.
- **`scss/components/_modal.scss`** — already styles both modifiers (video:
  16:9 black background; image: contain, capped viewport). No changes needed.

## The poster-image trap (read this before wiring the bridge template)

The bug that will bite you: a component's `image` prop is usually fed by
`content.field_media.0` — the **rendered field output**. For an Image media
entity that's a plain `<img>`. For a Video media entity, it's whatever display
formatter is configured on that field (commonly `video_embed_field`'s
responsive iframe player) — a second, *live, already-playing* embed sitting
right where you meant to put a static thumbnail. Symptoms: the "image" shows
YouTube's own player chrome instead of a photo, the video plays on page load,
and the modal you built appears to open on top of an already-active video.

The fix is the same one `video_testimonial`'s preprocess already established:
**expose a separate `thumbnail_url`** (a plain file URL string, not rendered
output) and have the bridge template pick it over the rendered field whenever
video is present, passing that URL as `image`. The component then renders
`<img src="{{ image }}">` for the video branch instead of printing `{{ image }}`. See `references/preprocess-pattern.md` for
the exact precedence (media's `field_image`, falling back to the
auto-populated `thumbnail`) and the full extraction code.

## Step 1 — Confirm the field can actually hold video

The media field's name comes from the bridge template that already feeds the
component's `image` prop; any other name follows CLAUDE.md's field-name rule.
What is left to confirm is whether that field's allowed bundles include
Video/Remote video. Ask the user to check at
`/admin/structure/paragraphs_type/<type>/fields`.

If the bundles are unconfirmed, proceed anyway, report them as unverified, and
write the preprocess **defensively**
(`hasField()` + `isEmpty()` guards before every access, mirrored from
`example_subtheme_preprocess_paragraph__video_testimonial()`) so it silently
no-ops — image renders exactly as it did before — on any bundle that isn't
video-capable. Never let an unconfirmed field assumption throw a fatal on a
page that worked yesterday.

## Step 2 — Extend the preprocess function

Check `example_subtheme.theme` for an existing `hook_preprocess_paragraph__<type>`
for this component's bundle before creating a new one — it may already exist
(e.g. for other fields) and just need extending, the way `50_50_component`'s
did. Add, gated behind the same media-entity guard:

- `video_url` — prefer the media's `field_video` (video_embed_field), fall
  back to `field_media_oembed_video` (core remote_video).
- `thumbnail_url` — only computed if `video_url` ended up set. Prefer the
  media's `field_image`, fall back to the auto-populated `thumbnail`.

Full copy-paste template: `references/preprocess-pattern.md`.

## Step 3 — Update the bridge template

Swap the `image` value based on whether video was found:

```twig
{% set image = video_url ? thumbnail_url : content.field_media.0 %}

{% include '@example/<component>/<component>.twig' with {
  image: image,
  video_url: video_url,
  ...
} only %}
```

Passing an unset `video_url`/`thumbnail_url` through `only` is safe — Twig
resolves an undefined variable to falsy, and this is exactly how
`video_testimonial` already relies on it in production.

## Step 4 — Update the component

- Add `video_url` to the docblock's prop list, and note that `image` becomes a
  plain URL string (not render output) whenever `video_url` is set — the
  component must render `<img src="{{ image }}" alt="">` for that branch, not
  `{{ image }}`. `alt=""` is correct: the wrapping button already carries the
  accessible name via `aria-label`, so the image is decorative in that
  context.
- Gate a modal include near the top of the component:
  ```twig
  {% if video_url %}
    {% include '@example/modal/modal.twig' with {
      modal_label: title ? 'Video: @title'|t({'@title': title}) : 'Video'|t,
      modifier: 'video',
    } %}
  {% endif %}
  ```
- Wrap the image in a play-trigger `<button>` when `video_url` is present.
  **Prefer wrapping the whole image in one button** over an absolutely
  positioned overlay unless the component already layers independently
  animating content over the image (like `video_testimonial`'s
  name/subtitle-on-hover) — a single button avoids positioning math against a
  responsive image of variable height and keeps one accessible control with
  one label. Full markup (including the shared play-icon SVG) in
  `references/component-markup.md`.
- If the image sits inside a container with `overflow: hidden` (a rounded
  corner, a notch, a clip), give the trigger's focus ring a **negative**
  `outline-offset` via the existing `focus-ring()` mixin
  (`@include focus-ring($example-accent-focus, -2px)`) so it draws inward and
  isn't clipped by the ancestor. Same mixin, just tune the offset argument —
  no new mixin needed.

## Step 5 — Add the JS behavior

Create `js/components/<component>.js` from the template in
`references/component-markup.md` (JS): it calls `wireVideoModalTriggers` per
matched section and `closeVideoModal` on unload. If the component already has a JS
behavior, add those two calls to its `attach()`/`detach()` instead. Import the file
in `js/example_scripts.js`.

## Step 6 — Verify

```bash
fin drush cr
```

Then, on a page rendering the component:

- **Image-only media**: confirm nothing changed — no button, no modal markup,
  same as before this work.
- **Video media**: confirm the image shows a static poster (not a live
  player), a play icon appears, clicking opens the modal with an autoplaying
  embed, and closing (X button / backdrop click / Escape) actually stops
  playback (content is cleared, not just hidden).
- **Keyboard**: tab to the trigger, confirm the focus ring is visible and not
  clipped, Enter/Space opens the modal.
- `npm run build` (lint:scss + lint:js + scss + esbuild) from
  `web/themes/custom/example_subtheme` — clean is required, not optional.
- `fin exec 'php -l web/themes/custom/example_subtheme/example_subtheme.theme'`.
- Re-check the *other* component(s) already using this modal (currently
  `video_testimonial`) still work — a shared `js/utils/video-embed.js` change
  is a shared blast radius.

## Multiple instances on one page

Already safe: every piece is scoped to its own `section`, never to `document`
(`references/component-markup.md`, "Multi-instance safety"). Keep it that way in
new components.

One accepted edge case, not a bug: if a user opens one section's modal
without closing it, then clicks a trigger in a *different* section, the
second `<dialog>` opens independently stacked on top (native `<dialog>`
doesn't auto-close siblings). Only the topmost is visible/interactive with
its own backdrop — not broken, just not perfectly tidy state. Left
unaddressed deliberately; don't "fix" this without checking whether the
tradeoff still holds.

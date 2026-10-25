# Component markup + JS template

Copy-paste starting points, taken from the real `split-card` implementation.
Rename `split-card` → your component throughout; keep the class name prefix
consistent with your component's existing BEM prefix.

## Twig: modal include + play-trigger button

```twig
<section class="example-<component> example-<component>--{{ theme }}" aria-label="{{ title }}">
  {% if video_url %}
    {% include '@example/modal/modal.twig' with {
      modal_label: title ? 'Video: @title'|t({'@title': title}) : 'Video'|t,
      modifier: 'video',
    } %}
  {% endif %}

  {# ... rest of the component ... #}

  {% if image %}
    <div class="example-<component>__image">
      {% if video_url %}
        <button
          class="example-<component>__image-trigger js-<component>-play"
          type="button"
          aria-haspopup="dialog"
          aria-label="{{ title ? 'Play video: ' ~ title : 'Play video' }}"
          data-video-url="{{ video_url }}"
        >
          <img src="{{ image }}" alt="" loading="lazy">
          <span class="example-<component>__play" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" focusable="false">
              <path
                d="M32.0002 58.6666C46.7278 58.6666 58.6668 46.7275 58.6668 31.9999C58.6668 17.2723 46.7278 5.33325 32.0002 5.33325C17.2726 5.33325 5.3335 17.2723 5.3335 31.9999C5.3335 46.7275 17.2726 58.6666 32.0002 58.6666Z"
                stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M26.6668 21.3333L42.6668 31.9999L26.6668 42.6666V21.3333Z" stroke="white" stroke-width="4"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>
      {% else %}
        {{ image }}
      {% endif %}
    </div>
  {% endif %}
</section>
```

Note the `image` branch: when `video_url` is set, `image` must be a plain URL
string (from the preprocess's `thumbnail_url`) rendered as `<img src="...">`
— not `{{ image }}` render output. See the SKILL.md "poster-image trap"
section for why. `alt=""` is intentional: the button's `aria-label` already
names the action, so the image itself is decorative here.

If your component layers other content over the image (text that fades on
hover, like `video_testimonial`'s name/subtitle), use an absolutely
positioned overlay button instead of wrapping — see
`templates/paragraphs/paragraph--video-testimonial.html.twig` and
`scss/components/_testimonials.scss`'s `&__play`/`&__card-overlay` for that
variant. Most components without that layering don't need it — button-wraps-
image is simpler and avoids positioning math against a responsive image of
variable height.

## SCSS: trigger + play icon

```scss
&__image-trigger {
  background: none;
  border: none;
  cursor: pointer;
  display: block;
  padding: 0;
  position: relative;
  width: 100%;

  &:focus-visible {
    // Negative offset only if the ancestor image container clips overflow
    // (rounded corner, notch) — see SKILL.md Step 4. Use a normal positive
    // offset (the focus-ring() default) if there's no such ancestor.
    @include focus-ring($example-accent-focus, -2px);
  }
}

&__play {
  align-items: center;
  background: rgb(9 10 11 / 40%);
  border-radius: 50%;
  display: flex;
  height: rem(64px);
  justify-content: center;
  left: 50%;
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: rem(64px);

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.35s ease;
  }

  .example-<component>__image-trigger:hover &,
  .example-<component>__image-trigger:focus-visible & {
    transform: translate(-50%, -50%) scale(1.15);
  }
}
```

The `rgb(9 10 11 / 40%)` backing circle exists because a bare white-stroke SVG
can get lost against a bright photo — testimonials doesn't need this because
its play icon already sits on top of a full-card dark overlay
(`&__card-overlay`) for a different reason (fading the card's own text on
hover). If your component already has a similar full-image overlay, skip the
backing circle and let the overlay do the contrast work instead.

## JS: `js/components/<component>.js`

The click/iframe/modal-open wiring itself lives in
`js/utils/video-embed.js`'s `wireVideoModalTriggers()` and
`closeVideoModal()` — shared by every component, not copy-pasted per
component (see SKILL.md Architecture facts). A new component's behavior file
is just:

```js
/**
 * @file
 * <Component> — video modal trigger.
 *
 * The image doubles as a play button when video_url is present. Reuses the
 * shared <dialog> modal (Drupal.ExampleModal) — see js/components/modal.js.
 */
import { wireVideoModalTriggers, closeVideoModal } from '../utils/video-embed';

(function (Drupal, once) {
  Drupal.behaviors.example<Component> = {
    attach(context) {
      once('example-<component>', '.example-<component>', context).forEach((section) => {
        wireVideoModalTriggers(section, '.js-<component>-play');
      });
    },

    detach(context, settings, trigger) {
      if (trigger !== 'unload') {
        return;
      }
      once
        .remove('example-<component>', '.example-<component>', context)
        .forEach((section) => closeVideoModal(section));
    },
  };
})(Drupal, once);
```

This is the real, current `split-card.js` with names swapped — copy it
directly.

If the component already has its own `js/components/<component>.js` for
unrelated behavior (a slider, an accordion), add the
`wireVideoModalTriggers`/`closeVideoModal` calls inside its existing
`attach()`/`detach()` rather than creating a second behavior — see
`js/components/testimonials.js` for a real example of modal wiring
coexisting with slider logic in one file.

Register the new or extended file in `js/example_scripts.js`:
```js
import './components/<component>';
```

### Multi-instance safety, for free

`wireVideoModalTriggers(section, selector)` and `closeVideoModal(section)`
only ever query inside the `section` element passed in — never `document`.
As long as your `once()` loop passes each matched section through (as the
template above does), N instances of the component on one page each get
their own independently wired modal automatically. Don't add any `id`-based
or `document.querySelector`-based lookup here — it would break that.

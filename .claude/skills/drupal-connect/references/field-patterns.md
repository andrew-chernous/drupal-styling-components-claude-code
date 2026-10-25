# Drupal Field → Component Prop Patterns

Read this when writing a bridge template. Everything here is taken from the seven
bridge templates already in `templates/paragraphs/` — following them keeps new
bridges consistent with what is there, which matters because the next person
debugging one will pattern-match against the existing files.

## Field names already used in this theme

Paragraph types here reuse a common set of fields. Offer these as candidates when
asking the user which field feeds a prop — but confirm, never assume. Field config
lives in the database, not this repo, so the only authority is the admin UI at
`/admin/structure/paragraphs_type/<type>/fields`.

| Purpose | Fields seen in this theme |
|---|---|
| Titles | `field_title`, `field_title_ext`, `field_subheading` |
| Body copy | `field_body_plain`, `field_body_plain_ext`, `field_body_wysiwyg` |
| Links / CTAs | `field_cta_buttons`, `field_links`, `field_link` |
| Media | `field_image`, `field_carousel_image`, `field_media`, `field_video` |
| Repeating children | `field_stats`, `field_icon_text_item`, `field_testimonial_items` |
| Variants | `field_background_theme`, `field_icons_layout` |

## Raw vs rendered — the distinction that matters most

Two ways to read a field, and picking the wrong one is the most common bug in a
bridge template:

- `paragraph.field_x.value` — the **raw** stored value. Use for plain text, list
  keys, and anything compared or tested in a condition.
- `content.field_x|field_value` — the **rendered** output. Use for rich text
  (`field_body_wysiwyg`), because this is what preserves CKEditor markup and
  applies the text format's filters. Reading rich text raw dumps unfiltered
  markup and skips the format's security filtering.
- `content.field_image.0` — a rendered image render array, passed through whole
  so image styles and lazy-loading survive.

Presence tests use the raw object: `paragraph.field_image is not empty`.

## CTA arrays

Every bridge that has buttons builds them the same way:

```twig
{% set ctas = [] %}
{% for item in paragraph.field_cta_buttons %}
  {% set ctas = ctas|merge([{ url: item.url, title: item.title }]) %}
{% endfor %}
```

## Multi-value rendered children

Pair the raw loop with the rendered array by index — the raw side drives iteration,
the rendered side supplies the output (from `paragraph--testimonials.html.twig`):

```twig
{% set items = [] %}
{% for item in paragraph.field_testimonial_items %}
  {% set items = items|merge([content.field_testimonial_items[loop.index0]]) %}
{% endfor %}
```

## Deriving variants

Compute the variant in the bridge so the component stays a pure renderer
(from `paragraph--hero-banner.html.twig`):

```twig
{% set has_image = paragraph.field_image is not empty %}
{% set variant = has_image ? 'image-bg' : (paragraph.field_background_theme.value ?: 'light') %}
```

## Fallback chains

When one field takes precedence over another, resolve it in the bridge
(from `paragraph--feature-banner.html.twig`):

```twig
{% set slides = [] %}
{% if paragraph.field_carousel_image is not empty %}
  {% for item in paragraph.field_carousel_image %}
    {% set slides = slides|merge([{ content: content.field_carousel_image[loop.index0] }]) %}
  {% endfor %}
{% elseif paragraph.field_image is not empty %}
  {% set slides = [{ content: content.field_image[0] }] %}
{% endif %}
```

## Preprocess for referenced entities

Required when children come from an entity reference field — the Twig sandbox
blocks `referencedEntities()`, so this cannot be done in the template. Model on
`example_subtheme_preprocess_paragraph__stats()`:

```php
function example_subtheme_preprocess_paragraph__<type>(array &$variables): void {
  /** @var \Drupal\paragraphs\Entity\Paragraph $paragraph */
  $paragraph = $variables['paragraph'];
  $items = [];

  if ($paragraph->hasField('<field>') && !$paragraph->get('<field>')->isEmpty()) {
    foreach ($paragraph->get('<field>')->referencedEntities() as $child) {
      if (!$child instanceof Paragraph) {
        continue;
      }
      $items[] = [
        'title' => $child->get('field_title')->value ?? '',
      ];
    }
  }

  $variables['<name>_items'] = $items;
}
```

Guard with `hasField()` + `isEmpty()` and default every value with `?? ''` —
editors leave fields blank, and an unguarded `->value` on a missing field is a
fatal error on a page that previously worked.

Link fields need unwrapping (from the `icon_text` preprocess):

```php
$link_item = $item->get('field_link')->first();
$link = ['url' => $link_item->getUrl()->toString(), 'title' => $link_item->title ?? ''];
```

Media needs its own chain — see `example_subtheme_preprocess_paragraph__video_testimonial()`
for the thumbnail (`field_image` → auto `thumbnail`) and video
(`field_video` → `field_media_oembed_video`) fallbacks.

Flatten to plain arrays. Passing entity objects into a component couples it to
Drupal and re-introduces the sandbox problem one level down.

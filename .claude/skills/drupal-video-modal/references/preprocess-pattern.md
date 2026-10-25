# Preprocess pattern: video_url + thumbnail_url

Two real examples in `example_subtheme.theme` today — read both before writing a
third, since the second one (`50_50_component`) is the more defensive variant
and is closer to what a new, unconfirmed field needs.

## Reference 1: `example_subtheme_preprocess_paragraph__video_testimonial()`

The original version. Assumes `field_media` always exists and always holds
video on this bundle (true for `video_testimonial` specifically):

```php
/**
 * Implements hook_preprocess_HOOK() for paragraph templates.
 *
 * Exposes two Twig variables from the referenced media entity:
 *   thumbnail_url — root-relative URL for the card background image.
 *   video_url     — OEmbed source URL (YouTube/Vimeo watch URL).
 */
function example_subtheme_preprocess_paragraph__video_testimonial(array &$variables): void {
  $paragraph = $variables['paragraph'];

  if ($paragraph->get('field_media')->isEmpty()) {
    return;
  }

  /** @var \Drupal\media\Entity\Media $media */
  $media = $paragraph->get('field_media')->entity;
  if (!$media instanceof Media) {
    return;
  }

  // Thumbnail: prefer field_image on the media entity (set by editors),
  // fall back to the auto-populated thumbnail (populated from YouTube/Vimeo).
  if ($media->hasField('field_image') && !$media->get('field_image')->isEmpty()) {
    $file = $media->get('field_image')->entity;
    if ($file) {
      $variables['thumbnail_url'] = $file->createFileUrl();
    }
  }
  if (empty($variables['thumbnail_url']) && !$media->get('thumbnail')->isEmpty()) {
    $file = $media->get('thumbnail')->entity;
    if ($file) {
      $variables['thumbnail_url'] = $file->createFileUrl();
    }
  }

  // Video URL: prefer field_video (video_embed_field), fall back to
  // field_media_oembed_video (core remote_video media type).
  if ($media->hasField('field_video') && !$media->get('field_video')->isEmpty()) {
    $variables['video_url'] = $media->get('field_video')->value;
  }
  elseif ($media->hasField('field_media_oembed_video')
    && !$media->get('field_media_oembed_video')->isEmpty()) {
    $variables['video_url'] = $media->get('field_media_oembed_video')->value;
  }
}
```

## Reference 2: `example_subtheme_preprocess_paragraph__50_50_component()`

The defensive variant, used when the field's allowed bundles on this
paragraph type couldn't be confirmed from the DB. Two differences from
Reference 1, both deliberate:

1. `hasField('field_media')` is checked before `get('field_media')` — Reference
   1 skips this because that bundle's field config is known; here it isn't.
2. `thumbnail_url` is only computed *after* `video_url` is confirmed set
   (`if (empty($variables['video_url'])) { return; }`) — no point resolving a
   poster image for media that turned out not to be video.

This function also does unrelated work first (`quick_link_items` — building
an array from a different referenced-entity field). That's the normal case:
you're usually extending an existing preprocess function for this bundle, not
creating a new one. Append the video/thumbnail block to whatever's already
there rather than writing a second function for the same paragraph type.

```php
// video_url: only set if field_media references a video-capable Media
// entity. Written defensively — field_media's allowed bundles on
// <bundle> could not be confirmed (field config is not in git,
// Drush can't bootstrap locally); this simply no-ops if the referenced
// media has neither field_video nor field_media_oembed_video.
if (!$paragraph->hasField('field_media') || $paragraph->get('field_media')->isEmpty()) {
  return;
}

/** @var \Drupal\media\Entity\Media $media */
$media = $paragraph->get('field_media')->entity;
if (!$media instanceof Media) {
  return;
}

if ($media->hasField('field_video') && !$media->get('field_video')->isEmpty()) {
  $variables['video_url'] = $media->get('field_video')->value;
}
elseif ($media->hasField('field_media_oembed_video')
  && !$media->get('field_media_oembed_video')->isEmpty()) {
  $variables['video_url'] = $media->get('field_media_oembed_video')->value;
}

if (empty($variables['video_url'])) {
  return;
}

// Poster image: content.field_media.0 renders the video field's own
// player (video_embed_field's responsive iframe), not a static image, so
// the bridge template must use this instead for the video case. Same
// precedence as video_testimonial's thumbnail_url above.
if ($media->hasField('field_image') && !$media->get('field_image')->isEmpty()) {
  $file = $media->get('field_image')->entity;
  if ($file) {
    $variables['thumbnail_url'] = $file->createFileUrl();
  }
}
if (empty($variables['thumbnail_url']) && !$media->get('thumbnail')->isEmpty()) {
  $file = $media->get('thumbnail')->entity;
  if ($file) {
    $variables['thumbnail_url'] = $file->createFileUrl();
  }
}
```

## Which to model your new preprocess on

Use Reference 2's guard style (`hasField()` before `get()`, and the
`video_url`-first-then-`thumbnail_url` ordering) unless you've directly
confirmed in the admin UI that the field on your bundle always holds video —
in that narrow case Reference 1's shorter form is fine. When in doubt, the
defensive version costs nothing at runtime and prevents a fatal on any bundle
where the field config turns out not to match what you assumed.

`Media` and `Paragraph` are already imported at the top of `example_subtheme.theme`
(`use Drupal\media\Entity\Media;`, `use Drupal\paragraphs\Entity\Paragraph;`) —
reuse those imports, don't add new ones.

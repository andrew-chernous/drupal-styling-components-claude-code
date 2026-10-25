#!/usr/bin/env bash
#
# Print the subtheme design tokens, read from scss/base/ at run time.
#
# Two skills need the palette in different shapes: drupal-component-review reads SCSS
# and wants token names, drupal-design-verify reads the browser and needs to map a
# computed rgb() back to a token. Both used to keep their own hand-copied table and
# both had drifted from the Sass. This derives them instead.
#
# Usage:
#   tokens.sh          colors, breakpoints, containers, fonts, functions
#   tokens.sh --rgb    colors as computed rgb() -> token, for verification runs
#   tokens.sh --colors just the palette

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/web/themes/custom/example_subtheme/scss/base"

if [[ ! -d "$BASE" ]]; then
  echo "error: token directory not found at $BASE" >&2
  echo "Run this from inside the project repo." >&2
  exit 1
fi

# Emits "name<TAB>value" for every top-level Sass variable in a file.
vars_in() {
  rg --no-filename -o '^\$[a-z0-9-]+\s*:\s*[^;]+' "$BASE/$1" 2>/dev/null |
    sed -E 's/[[:space:]]*:[[:space:]]*/\t/' |
    sed -E 's/[[:space:]]+$//'
}

# Expands #abc to #aabbcc so the rgb conversion has six digits to work with.
print_rgb() {
  vars_in _colors.scss | while IFS=$'\t' read -r name hex; do
    h="${hex#\#}"
    if [[ ${#h} -eq 3 ]]; then
      h="${h:0:1}${h:0:1}${h:1:1}${h:1:1}${h:2:1}${h:2:1}"
    fi
    [[ ${#h} -eq 6 ]] || continue
    printf 'rgb(%d, %d, %d)\t%s\t%s\n' \
      "$((16#${h:0:2}))" "$((16#${h:2:2}))" "$((16#${h:4:2}))" "$name" "$hex"
  done | column -t -s $'\t'
}

case "${1:-}" in
  --rgb)
    echo "# Computed rgb() -> token. Near-miss rule: within ~2 per channel is that"
    echo "# token used wrongly, not a new color. rgba(0,0,0,0) is transparent."
    echo
    print_rgb
    ;;
  --colors)
    vars_in _colors.scss | column -t -s $'\t'
    ;;
  "")
    echo "== Colors =="
    vars_in _colors.scss | column -t -s $'\t'
    echo
    echo "== Breakpoints, containers, fonts, heights =="
    vars_in _variables.scss | column -t -s $'\t'
    echo
    echo "== Config =="
    vars_in _config.scss | column -t -s $'\t'
    echo
    echo "== Functions and mixins =="
    rg --no-filename -o '^@(function|mixin) [a-z-]+\([^)]*\)' "$BASE/_functions.scss"
    ;;
  *)
    echo "usage: tokens.sh [--rgb|--colors]" >&2
    exit 1
    ;;
esac

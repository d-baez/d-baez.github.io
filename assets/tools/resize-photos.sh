#!/usr/bin/env bash
#
# Generate web-sized copies of the about-page photos.
#
# Originals in assets/images/originals/ are full-resolution camera files
# (some over 10 MB) and are deliberately NOT tracked in git - see .gitignore.
# This writes ~800px JPEGs to assets/images/about/, which ARE tracked and are
# what the site actually serves. It then strips EXIF from the results, since
# sips carries metadata through a resize and some originals are geotagged.
#
# Because the originals are untracked, a fresh clone cannot re-run this.
# Keep assets/images/originals/ backed up somewhere outside the repo.
#
# Usage:
#   ./assets/tools/resize-photos.sh            # only rebuild what's stale
#   ./assets/tools/resize-photos.sh --force    # rebuild everything
#
# To add a photo to the pile: drop it in assets/images/originals/, add its
# filename to the PHOTOS list below, and re-run.
#
# Requires sips, which ships with macOS.

set -euo pipefail

MAX_DIM=800   # longest edge, in pixels
QUALITY=70    # JPEG quality, 0-100

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$repo_root/assets/images/originals"
OUT_DIR="$repo_root/assets/images/about"

PHOTOS=(
  danny-djaying.jpeg
  danny-dancing.jpg
  danny-RoPgraduate.JPG
  danny-SOEgraduate.jpeg
  danny-clacyaward.jpeg
  danny-stonewallaward.JPEG
  danny-ecuaflag.jpeg
  danny-ecuagame.JPG
  zimmerli-djdaledanny.JPG
  volcan-fuego.jpeg
)

force=0
if [[ "${1:-}" == "--force" ]]; then
  force=1
elif [[ -n "${1:-}" ]]; then
  echo "unknown option: $1" >&2
  echo "usage: $(basename "$0") [--force]" >&2
  exit 2
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "error: sips not found (expected on macOS)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

human() {
  awk -v b="$1" 'BEGIN{
    if (b > 1048576) printf "%.1fM", b/1048576;
    else printf "%dK", (b+1023)/1024;
  }'
}

built=0; skipped=0; missing=0
total_before=0; total_after=0

printf '%-34s %10s %10s   %s\n' "PHOTO" "BEFORE" "AFTER" "STATUS"
printf '%.0s-' {1..72}; echo

for name in "${PHOTOS[@]}"; do
  src="$SRC_DIR/$name"

  if [[ ! -f "$src" ]]; then
    printf '%-34s %10s %10s   %s\n' "$name" "-" "-" "MISSING"
    missing=$((missing + 1))
    continue
  fi

  # Normalize the extension; the originals are a mix of .JPG/.JPEG/.jpeg/.jpg
  out="$OUT_DIR/${name%.*}.jpg"

  before=$(stat -f%z "$src")
  total_before=$((total_before + before))

  if [[ $force -eq 0 && -f "$out" && "$out" -nt "$src" ]]; then
    after=$(stat -f%z "$out")
    total_after=$((total_after + after))
    printf '%-34s %10s %10s   %s\n' "$name" "$(human "$before")" "$(human "$after")" "up to date"
    skipped=$((skipped + 1))
    continue
  fi

  # Bake in the display rotation before the metadata carrying it is dropped,
  # otherwise photos the camera stored sideways come out sideways.
  orient=$("$repo_root/assets/tools/exif-orientation.py" "$src")
  transform=()
  case "$orient" in
    3) transform=(--rotate 180) ;;
    6) transform=(--rotate 90) ;;
    8) transform=(--rotate 270) ;;
    2) transform=(--flip horizontal) ;;
    4) transform=(--flip vertical) ;;
    5) transform=(--flip horizontal --rotate 270) ;;
    7) transform=(--flip horizontal --rotate 90) ;;
  esac

  # The ${a[@]+"${a[@]}"} form is needed because bash 3.2, which is what
  # macOS ships, treats an empty array as unset under `set -u`.
  sips -Z "$MAX_DIM" \
       ${transform[@]+"${transform[@]}"} \
       --setProperty format jpeg \
       --setProperty formatOptions "$QUALITY" \
       "$src" --out "$out" >/dev/null 2>&1

  "$repo_root/assets/tools/strip-exif.py" "$out"

  after=$(stat -f%z "$out")
  total_after=$((total_after + after))
  printf '%-34s %10s %10s   %s\n' "$name" "$(human "$before")" "$(human "$after")" "built"
  built=$((built + 1))
done

printf '%.0s-' {1..72}; echo
printf '%-34s %10s %10s\n' "total" "$(human "$total_before")" "$(human "$total_after")"
echo
echo "built: $built   up to date: $skipped   missing: $missing"
echo "output: assets/images/about/"

if [[ $missing -gt 0 ]]; then
  exit 1
fi

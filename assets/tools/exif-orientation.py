#!/usr/bin/env python3
"""Print a JPEG's EXIF orientation value (1-8), or 1 if it has none.

Cameras often store a photo in its raw sensor orientation and record a tag
saying how to turn it for display. resize-photos.sh reads that tag so it can
bake the rotation into the pixels, because the tag itself is discarded when
the metadata is stripped.

  1 normal          5 transpose
  2 mirror horiz    6 rotate 90 CW
  3 rotate 180      7 transverse
  4 mirror vert     8 rotate 270 CW

Usage: exif-orientation.py FILE
"""
import struct
import sys


def orientation(path):
    with open(path, "rb") as fh:
        data = fh.read()

    if data[:2] != b"\xff\xd8":
        return 1

    i = 2
    end = len(data)

    while i < end - 1:
        if data[i] != 0xFF:
            return 1

        marker = data[i + 1]

        if marker == 0xDA:  # Start of Scan; no metadata beyond here.
            return 1
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        if i + 4 > end:
            return 1

        seg_len = (data[i + 2] << 8) | data[i + 3]
        if seg_len < 2:
            return 1

        if marker == 0xE1 and data[i + 4:i + 10] == b"Exif\x00\x00":
            return _read_tiff(data[i + 10:i + 2 + seg_len])

        i += 2 + seg_len

    return 1


def _read_tiff(tiff):
    """Pull tag 0x0112 (Orientation) out of the first IFD."""
    if len(tiff) < 8:
        return 1

    endian = ">" if tiff[:2] == b"MM" else "<"
    ifd = struct.unpack(endian + "I", tiff[4:8])[0]

    if ifd + 2 > len(tiff):
        return 1

    count = struct.unpack(endian + "H", tiff[ifd:ifd + 2])[0]

    for n in range(count):
        entry = ifd + 2 + n * 12
        if entry + 12 > len(tiff):
            break
        tag = struct.unpack(endian + "H", tiff[entry:entry + 2])[0]
        if tag == 0x0112:
            value = struct.unpack(endian + "H", tiff[entry + 8:entry + 10])[0]
            return value if 1 <= value <= 8 else 1

    return 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: exif-orientation.py FILE", file=sys.stderr)
        sys.exit(2)
    try:
        print(orientation(sys.argv[1]))
    except OSError as exc:
        print(f"exif-orientation: {exc}", file=sys.stderr)
        sys.exit(1)

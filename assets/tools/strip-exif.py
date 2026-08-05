#!/usr/bin/env python3
"""Strip metadata segments from JPEG files, in place.

sips re-encodes image data but carries EXIF through, so resized photos keep
whatever the camera recorded - including GPS coordinates. This removes the
EXIF/XMP (APP1) and Photoshop/IPTC (APP13) segments.

APP0 (JFIF) and APP2 (ICC colour profile) are kept, so colour rendering is
unaffected.

Usage: strip-exif.py FILE [FILE ...]
"""
import sys

# APP1 holds EXIF and XMP; APP13 holds Photoshop/IPTC records.
DROP_MARKERS = {0xE1, 0xED}

# Markers that stand alone with no length field following them.
STANDALONE = {0x01, 0xD8, 0xD9} | set(range(0xD0, 0xD8))


def strip(path):
    """Rewrite path without metadata segments. Returns bytes removed."""
    with open(path, "rb") as fh:
        data = fh.read()

    if data[:2] != b"\xff\xd8":
        raise ValueError("not a JPEG (missing SOI marker)")

    out = bytearray(data[:2])
    i = 2
    end = len(data)

    while i < end - 1:
        if data[i] != 0xFF:
            # Not at a marker boundary; copy the remainder untouched rather
            # than risk corrupting the file.
            out += data[i:]
            break

        marker = data[i + 1]

        if marker in STANDALONE:
            out += data[i:i + 2]
            i += 2
            continue

        if marker == 0xDA:  # Start of Scan - entropy-coded data to the end.
            out += data[i:]
            break

        if i + 4 > end:
            out += data[i:]
            break

        seg_len = (data[i + 2] << 8) | data[i + 3]
        seg_end = i + 2 + seg_len

        if seg_len < 2 or seg_end > end:
            # Malformed length; bail out without dropping anything further.
            out += data[i:]
            break

        if marker not in DROP_MARKERS:
            out += data[i:seg_end]

        i = seg_end

    removed = len(data) - len(out)
    if removed:
        with open(path, "wb") as fh:
            fh.write(out)
    return removed


def main(argv):
    if not argv:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2

    status = 0
    for path in argv:
        try:
            strip(path)
        except (OSError, ValueError) as exc:
            print(f"strip-exif: {path}: {exc}", file=sys.stderr)
            status = 1
    return status


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

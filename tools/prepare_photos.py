import argparse
import hashlib
import io
import json
import re
import sys
from datetime import date
from pathlib import Path

from PIL import ExifTags, Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "memories.json"
WEB = ROOT / "assets" / "photos" / "web"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}
VARIANTS = {
    "thumbnails": (480, 32 * 1024),
    "display": (1600, 160 * 1024),
}
DATE_PATTERN = re.compile(r"(19\d{2}|20\d{2})\D?(\d{2})\D?(\d{2})")


def first_valid_date(text):
    for match in DATE_PATTERN.finditer(text):
        year, month, day = (int(part) for part in match.groups())
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            continue
    return ""


def photo_date(photo, path):
    exif = photo.getexif()
    camera_ifd = exif.get_ifd(ExifTags.IFD.Exif)
    candidates = [
        camera_ifd.get(ExifTags.Base.DateTimeOriginal),
        camera_ifd.get(ExifTags.Base.DateTimeDigitized),
        exif.get(ExifTags.Base.DateTime),
        path.name,
    ]
    for value in candidates:
        if isinstance(value, bytes):
            value = value.decode("ascii", errors="replace")
        if isinstance(value, str):
            found = first_valid_date(value)
            if found:
                return found
    return ""


def encode_webp(photo, longest_edge, byte_limit):
    preview = photo.copy()
    while True:
        preview.thumbnail((longest_edge, longest_edge), Image.Resampling.LANCZOS)
        for quality in (82, 72, 62):
            with io.BytesIO() as output:
                # Do not copy EXIF (including GPS), ICC, or XMP into published files.
                preview.save(output, "WEBP", quality=quality, method=5)
                if output.tell() <= byte_limit:
                    return output.getvalue()
        if longest_edge <= 180:
            raise ValueError(f"could not compress to {byte_limit // 1024} KiB")
        longest_edge = max(180, int(longest_edge * .8))


def load_manifest():
    text = MANIFEST.read_text(encoding="utf-8").strip()
    manifest = json.loads(text) if text else {"her": [], "us": []}
    if isinstance(manifest, list):
        # Migrate the old flat-list format into the grouped one.
        migrated = {"her": [], "us": []}
        for entry in manifest:
            migrated[entry["category"]].append(entry)
        manifest = migrated
    if (
        not isinstance(manifest, dict)
        or sorted(manifest) != ["her", "us"]
        or any(
            not isinstance(entry, dict) or not isinstance(entry.get("id"), str)
            for group in manifest.values() for entry in group
        )
    ):
        raise ValueError('data/memories.json must be {"her": [...], "us": [...]} with photo records carrying IDs')
    for group in manifest.values():
        for entry in group:
            entry.pop("category", None)
            entry.pop("chapter", None)
    return manifest


def save_manifest(manifest):
    for group in manifest.values():
        # Dated photos first in date order; undated ones keep their position at the end.
        group.sort(key=lambda entry: (entry.get("date", "") == "", entry.get("date", "")))
    pending = MANIFEST.with_suffix(".json.tmp")
    pending.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    pending.replace(MANIFEST)


def summarize(added=0, skipped=0, failures=0, removed_entries=0, removed_files=0):
    size = sum(path.stat().st_size for path in WEB.rglob("*.webp"))
    print(
        f"Added {added}; already present {skipped}; failed {failures}; "
        f"pruned {removed_entries} manifest entries and {removed_files} WebP files. "
        f"Web photos total: {size / 2**20:.1f} MiB."
    )


def entries_with_files(group):
    for entry in group:
        if all((WEB / variant / f"{entry['id']}.webp").is_file() for variant in VARIANTS):
            yield entry
        else:
            print(f"Dropping {entry['id']}: its WebP files are missing", file=sys.stderr)


def prune():
    manifest = load_manifest()
    removed_entries = removed_files = 0
    for group in manifest.values():
        complete = list(entries_with_files(group))
        removed_entries += len(group) - len(complete)
        group[:] = complete
    keep = {entry["id"] for group in manifest.values() for entry in group}
    for path in WEB.rglob("*.webp"):
        if path.stem not in keep:
            path.unlink()
            removed_files += 1
    save_manifest(manifest)
    summarize(removed_entries=removed_entries, removed_files=removed_files)
    return 0


def prepare(folder, category):
    photos = sorted(
        path for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in EXTENSIONS
    )
    if not photos:
        raise ValueError("No supported images found. For HEIC, export a JPEG copy first.")

    manifest = load_manifest()
    known = {entry["id"] for group in manifest.values() for entry in group}
    added = skipped = failures = 0
    for path in photos:
        try:
            with path.open("rb") as source:
                photo_id = hashlib.file_digest(source, "sha256").hexdigest()[:20]
            targets = {variant: WEB / variant / f"{photo_id}.webp" for variant in VARIANTS}
            if photo_id in known and all(target.is_file() for target in targets.values()):
                skipped += 1
                continue
            with Image.open(path) as source:
                taken = photo_date(source, path)
                oriented = ImageOps.exif_transpose(source)
                photo = oriented.convert("RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB")
                variants = {name: encode_webp(photo, *spec) for name, spec in VARIANTS.items()}
            for name, target in targets.items():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(variants[name])
            if photo_id not in known:
                manifest[category].append({
                    "id": photo_id,
                    "date": taken,
                    "caption": "",
                    "alt": "",
                    "thumbnail": targets["thumbnails"].relative_to(ROOT).as_posix(),
                    "src": targets["display"].relative_to(ROOT).as_posix(),
                })
                known.add(photo_id)
                added += 1
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            print(f"Skipped {path.name}: {error}", file=sys.stderr)
            failures += 1

    save_manifest(manifest)
    summarize(added=added, skipped=skipped, failures=failures)
    return 1 if failures else 0


def main():
    parser = argparse.ArgumentParser(
        description="Prepare private scrapbook photos locally.",
        epilog="To delete a photo: remove its record from data/memories.json, then run --prune.",
    )
    parser.add_argument("folder", type=Path, nargs="?", help="Folder of original photos, outside the website")
    parser.add_argument("--category", choices=("us", "her"),
                        help="'us' fills Our Little Story; 'her' fills Things I Adore About You")
    parser.add_argument("--prune", action="store_true",
                        help="Delete generated WebPs without a manifest record, and drop records missing their WebPs")
    args = parser.parse_args()
    try:
        if args.prune:
            if args.folder or args.category:
                parser.error("--prune runs alone, without a folder or --category.")
            return prune()
        if not args.folder or not args.category:
            parser.error("Importing needs a folder and --category (or use --prune).")
        folder = args.folder.resolve()
        if not folder.is_dir() or folder.is_relative_to(ROOT) or ROOT.is_relative_to(folder):
            parser.error("Choose an existing originals folder outside the project (not a parent of the project).")
        return prepare(folder, args.category)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Photo tool failed: {error}\n")


if __name__ == "__main__":
    sys.exit(main())

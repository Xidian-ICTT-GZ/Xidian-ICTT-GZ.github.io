"""Scan the fixed gallery folder and prepare assets for opening students.html directly."""

import hashlib
import json
import os
from pathlib import Path
from shutil import which
from subprocess import DEVNULL, run
from tempfile import TemporaryDirectory
from urllib.parse import quote

SITE_ROOT = Path(__file__).resolve().parents[1]
GALLERY_FOLDER = SITE_ROOT / "imgs/student-gallery"
THUMBNAIL_VERSION = 2
IMAGE_TYPES = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def gallery_files(root):
    for directory, folders, files in os.walk(root):
        folders[:] = sorted(name for name in folders if not name.startswith("."))
        for name in sorted(files):
            path = Path(directory) / name
            if name.startswith(".") or path.suffix.lower() not in IMAGE_TYPES or path.is_symlink():
                continue
            try:
                metadata = path.stat()
            except OSError:
                continue
            if path.is_file():
                yield path, metadata


def write_sips_image(sips, source, destination, *options):
    result = run(
        [sips, *options, "-s", "format", "jpeg", "-s", "formatOptions", "82",
         str(source), "--out", str(destination)],
        stdout=DEVNULL, stderr=DEVNULL, check=False,
    )
    return result.returncode == 0 and destination.is_file()


def write_thumbnail(source, destination, sips):
    try:
        from PIL import Image, ImageOps
    except ModuleNotFoundError:
        if not sips:
            return False
        if source.suffix.lower() not in {".jpg", ".jpeg"}:
            return write_sips_image(sips, source, destination, "-Z", "720")

        # Re-encode camera JPEGs first. Direct sips scaling can produce black
        # thumbnails when the source contains an auxiliary HDR image.
        normalized = destination.with_suffix(".original.jpg")
        try:
            if not write_sips_image(sips, source, normalized):
                return False
            return write_sips_image(sips, normalized, destination, "-Z", "720")
        finally:
            normalized.unlink(missing_ok=True)

    try:
        with Image.open(source) as image:
            image.draft("RGB", (640, 480))
            thumbnail = ImageOps.fit(ImageOps.exif_transpose(image), (640, 480))
            thumbnail.convert("RGB").save(destination, quality=82, optimize=True)
    except (OSError, Image.DecompressionBombError):
        return False
    return True


def page_url(path):
    return "./" + quote(path.relative_to(SITE_ROOT).as_posix())


def update_gallery():
    cache = GALLERY_FOLDER / ".gallery-cache"
    cache.mkdir(parents=True, exist_ok=True)
    sips = which("sips")
    photos = []
    with TemporaryDirectory(dir=cache) as temporary:
        staging = Path(temporary)
        for path, metadata in gallery_files(GALLERY_FOLDER):
            version = f"{THUMBNAIL_VERSION}:{path.relative_to(GALLERY_FOLDER)}:{metadata.st_mtime_ns}:{metadata.st_size}"
            name = hashlib.sha256(os.fsencode(version)).hexdigest() + ".jpg"
            thumbnail = cache / name
            if not thumbnail.is_file():
                prepared = staging / name
                if write_thumbnail(path, prepared, sips):
                    prepared.replace(thumbnail)
                else:
                    thumbnail = path

            photos.append({
                "src": page_url(path),
                "thumbnail": page_url(thumbnail),
                "alt": path.stem,
            })

        index = staging / "index.js"
        index.write_text("window.studentGalleryPhotos = " + json.dumps(photos, indent=2) + ";\n", encoding="utf-8")
        index.replace(cache / "index.js")

    print(f"学生图廊已更新，共 {len(photos)} 张照片。可直接打开 students.html。")


if __name__ == "__main__":
    update_gallery()

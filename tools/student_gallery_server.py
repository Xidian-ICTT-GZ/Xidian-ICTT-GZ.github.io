"""Preview the website and its photo gallery on this computer."""

import argparse
from functools import lru_cache, partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
import os
from pathlib import PurePosixPath
from urllib.parse import quote, unquote, urlsplit

from PIL import Image, ImageOps

from update_student_gallery import GALLERY_FOLDER, IMAGE_TYPES, SITE_ROOT, gallery_files

GALLERY_ROUTE = "/__student_gallery/"


@lru_cache(maxsize=128)
def thumbnail_bytes(path, modified_ns, size):
    """Keep the resized image until the file changes."""
    with Image.open(path) as image, BytesIO() as output:
        image.draft("RGB", (512, 384))
        thumbnail = ImageOps.fit(ImageOps.exif_transpose(image), (512, 384))
        thumbnail.convert("RGB").save(output, "JPEG", quality=82, optimize=True)
        return output.getvalue()


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, photo_root, **kwargs):
        self.photo_root = photo_root
        super().__init__(*args, directory=SITE_ROOT, **kwargs)

    def gallery_index(self):
        photos = []
        for path, metadata in gallery_files(self.photo_root):
            relative = quote(path.relative_to(self.photo_root).as_posix())
            version = f"{metadata.st_mtime_ns}-{metadata.st_size}"
            photos.append({
                "src": f"original/{relative}?v={version}",
                "thumbnail": f"thumbnail/{relative}?v={version}",
                "alt": path.stem,
            })
        return json.dumps({"photos": photos}, ensure_ascii=False).encode("utf-8")

    def open_photo(self, route, query):
        kind, _, name = route.partition("/")
        relative = PurePosixPath(name)
        image_type = IMAGE_TYPES.get(relative.suffix.lower())
        if (kind not in {"original", "thumbnail"} or not image_type
                or relative.is_absolute() or any(part.startswith(".") for part in relative.parts)):
            raise FileNotFoundError

        path = self.photo_root.joinpath(*relative.parts)
        if path.resolve(strict=True) != path or not path.is_file():
            raise FileNotFoundError

        metadata = path.stat()
        version = f"{metadata.st_mtime_ns}-{metadata.st_size}"
        cache = "private, max-age=86400" if query == f"v={version}" else "no-cache"
        if kind == "thumbnail":
            preview = thumbnail_bytes(path, metadata.st_mtime_ns, metadata.st_size)
            return BytesIO(preview), "image/jpeg", len(preview), cache

        original = path.open("rb")
        return original, image_type, os.fstat(original.fileno()).st_size, cache

    def send_head(self):
        url = urlsplit(self.path)
        if not url.path.startswith(GALLERY_ROUTE):
            return super().send_head()

        try:
            route = unquote(url.path[len(GALLERY_ROUTE):], errors="strict")
            if route == "gallery.json":
                data = self.gallery_index()
                body, content_type, length, cache = BytesIO(data), "application/json; charset=utf-8", len(data), "no-store"
            else:
                body, content_type, length, cache = self.open_photo(route, url.query)
        except (FileNotFoundError, NotADirectoryError, PermissionError, ValueError):
            self.send_error(404)
            return None
        except (OSError, Image.DecompressionBombError):
            self.send_error(422, "Cannot generate preview")
            return None

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        return body


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    photo_root = GALLERY_FOLDER.resolve()
    photo_root.mkdir(parents=True, exist_ok=True)

    handler = partial(PreviewHandler, photo_root=photo_root)
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Student gallery: http://127.0.0.1:{server.server_port}/students.html", flush=True)
        server.serve_forever()

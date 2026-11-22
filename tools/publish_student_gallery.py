"""Publish the public gallery using GitHub Release assets and GitHub Pages."""

import argparse
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
from time import monotonic, sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zipfile import ZipFile

from update_student_gallery import GALLERY_FOLDER, SITE_ROOT, gallery_files

REPO = "Xidian-ICTT-GZ/Xidian-ICTT-GZ.github.io"
SITE = "https://xidian.work"
ARCHIVE_NAME = "student-gallery.zip"
VERSION_PREFIX = "site-gallery-"
ASSET_PATH = re.compile(r"(?:photos|thumbnails)/[0-9a-f]{24}\.jpg")


def jpeg_bytes(image, quality):
    with BytesIO() as output:
        image.save(output, "JPEG", quality=quality, optimize=True)
        return output.getvalue()


def pack_gallery(destination, version):
    try:
        from PIL import Image, ImageOps
    except ImportError as error:
        raise ValueError("请先安装 Pillow：python3 -m pip install Pillow") from error

    if not GALLERY_FOLDER.is_dir():
        raise ValueError(f"找不到照片目录：{GALLERY_FOLDER}")

    photos = []
    with ZipFile(destination, "w") as archive:
        for source, _ in gallery_files(GALLERY_FOLDER):
            relative = source.relative_to(GALLERY_FOLDER)
            try:
                with Image.open(source) as image:
                    image.draft("RGB", (1200, 900))
                    oriented = ImageOps.exif_transpose(image)
                    oriented.thumbnail((1200, 900), Image.Resampling.LANCZOS)
                    if "A" in oriented.getbands() or "transparency" in oriented.info:
                        rgba = oriented.convert("RGBA")
                        published = Image.new("RGB", rgba.size, "white")
                        published.paste(rgba, mask=rgba.getchannel("A"))
                    else:
                        published = oriented.convert("RGB")
                    large = jpeg_bytes(published, 82)
                    preview = jpeg_bytes(ImageOps.fit(published, (640, 480), Image.Resampling.LANCZOS), 78)
            except (OSError, Image.DecompressionBombError) as error:
                raise ValueError(f"无法读取照片：{relative}") from error

            asset_id = hashlib.sha256(os.fsencode(relative) + b"\0" + large + preview).hexdigest()[:24]
            src = f"photos/{asset_id}.jpg"
            thumbnail = f"thumbnails/{asset_id}.jpg"
            archive.writestr(src, large)
            archive.writestr(thumbnail, preview)
            photos.append({"src": src, "thumbnail": thumbnail, "alt": source.stem})
        archive.writestr("gallery.json", json.dumps({"version": version, "photos": photos}, ensure_ascii=False))

    print(f"已打包 {len(photos)} 张照片，发布包 {destination.stat().st_size / 2**20:.1f} MiB。", flush=True)
    return len(photos)


def extract_gallery(source, destination, version):
    with ZipFile(source) as archive:
        manifest = json.loads(archive.read("gallery.json"))
        if manifest["version"] != version:
            raise ValueError("图廊索引版本与 Release 标签不一致。")

        files = ["gallery.json"]
        for photo in manifest["photos"]:
            src, thumbnail = photo["src"], photo["thumbnail"]
            if (not ASSET_PATH.fullmatch(src) or not ASSET_PATH.fullmatch(thumbnail)
                    or not src.startswith("photos/") or not thumbnail.startswith("thumbnails/")):
                raise ValueError("图廊发布包含有无效路径。")
            files.extend((src, thumbnail))

        if sorted(archive.namelist()) != sorted(set(files)) or len(files) != len(set(files)):
            raise ValueError("图廊发布包的照片与索引不匹配。")
        for filename in files:
            target = destination / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(filename) as entry, target.open("wb") as result:
                while block := entry.read(256 * 1024):
                    result.write(block)


def github_token():
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token

    result = subprocess.run(
        ["git", "credential", "fill"],
        input=f"protocol=https\nhost=github.com\npath={REPO}.git\n\n",
        text=True, capture_output=True, cwd=SITE_ROOT,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        check=False,
    )
    for line in result.stdout.splitlines():
        if line.startswith("password="):
            return line.partition("=")[2]
    raise ValueError("找不到可用的 GitHub 登录凭据。请配置 Git 的 GitHub 登录或 GH_TOKEN。")


def github_request(token, url, method, payload, content_type="application/json", length=None):
    if isinstance(payload, dict):
        payload = json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/vnd.github+json", "Content-Type": content_type}
    if length is not None:
        headers["Content-Length"] = str(length)
    request = Request(url, data=payload, method=method, headers=headers)
    request.add_unredirected_header("Authorization", f"Bearer {token}")
    try:
        with urlopen(request, timeout=90) as response:
            body = response.read()
            return json.loads(body) if body else None
    except HTTPError as error:
        try:
            message = json.load(error).get("message", error.reason)
        except ValueError:
            message = error.reason
        raise ValueError(f"GitHub API 返回 {error.code}：{message}") from error


def publish(archive, version, count, token):
    releases = f"https://api.github.com/repos/{REPO}/releases"
    draft = github_request(token, releases, "POST", {
        "tag_name": version,
        "name": f"团队影像 · {version.removeprefix(VERSION_PREFIX)}",
        "body": f"西电团队图廊发布包，共 {count} 张照片，含公开大图、缩略图和索引。",
        "draft": True,
        "make_latest": "false",
    })
    release = f"{releases}/{draft['id']}"
    upload = f"https://uploads.github.com/repos/{REPO}/releases/{draft['id']}/assets?"
    upload += urlencode({"name": ARCHIVE_NAME})
    with archive.open("rb") as source:
        asset = github_request(token, upload, "POST", source, "application/zip", archive.stat().st_size)
    if asset["state"] != "uploaded" or asset["size"] != archive.stat().st_size:
        raise ValueError(f"Release 附件校验失败，草稿仍保留在 {draft['html_url']}")
    published = github_request(token, release, "PATCH", {"draft": False, "make_latest": "false"})
    print(f"已发布 Release：{published['html_url']}", flush=True)
    workflow = f"https://api.github.com/repos/{REPO}/actions/workflows/pages.yml/dispatches"
    github_request(token, workflow, "POST", {"ref": "main"})


def wait_for_site(version):
    deadline = monotonic() + 300
    attempt = 0
    while monotonic() < deadline:
        attempt += 1
        query = urlencode({"version": version, "check": attempt})
        request = Request(f"{SITE}/gallery/gallery.json?{query}", headers={"Cache-Control": "no-cache"})
        try:
            with urlopen(request, timeout=10) as response:
                if json.load(response).get("version") == version:
                    print(f"线上图廊已更新：{SITE}/students.html")
                    return
        except (URLError, TimeoutError, ValueError):
            pass
        sleep(5)
    raise ValueError(f"Release 已发布，五分钟内尚未读到线上新版本。请查看 https://github.com/{REPO}/actions")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--pack-only", type=Path, metavar="ZIP")
    mode.add_argument("--extract", nargs=3, metavar=("ZIP", "DIRECTORY", "VERSION"))
    parser.add_argument("--no-wait", action="store_true", help="Publish without waiting for the public Pages update")
    args = parser.parse_args()
    version = VERSION_PREFIX + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%fZ")

    try:
        if args.extract:
            archive, destination, version = args.extract
            extract_gallery(Path(archive), Path(destination), version)
        elif args.pack_only:
            pack_gallery(args.pack_only, version)
            print(f"图廊包版本：{version}")
        else:
            token = github_token()
            with TemporaryDirectory() as temporary:
                archive = Path(temporary) / ARCHIVE_NAME
                count = pack_gallery(archive, version)
                publish(archive, version, count, token)
            if not args.no_wait:
                wait_for_site(version)
    except (ValueError, OSError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()

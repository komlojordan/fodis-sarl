import base64
import json
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".avif"}


def safe_filename(name):
    raw = Path(unquote(name or "image")).name
    clean = "".join(char if char.isalnum() or char in "._-" else "-" for char in raw)
    return clean or "image.png"


def is_image_upload(filename, data_url):
    suffix = Path(filename).suffix.lower()
    mime = ""
    if data_url.startswith("data:") and ";" in data_url:
        mime = data_url[5:].split(";", 1)[0].lower()
    guessed = mimetypes.guess_type(filename)[0] or ""
    return suffix in IMAGE_EXTENSIONS and (mime.startswith("image/") or guessed.startswith("image/"))


def unique_path(filename):
    target = ASSETS / filename
    if not target.exists():
        return target

    stem = target.stem
    suffix = target.suffix
    index = 2
    while True:
        candidate = ASSETS / f"{stem}-{index}{suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def asset_images():
    paths = []
    for path in sorted(ASSETS.rglob("*")):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            paths.append(path.relative_to(ROOT).as_posix())
    return paths


class AdminHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/assets-list":
            self.send_json(200, {"images": asset_images()})
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/upload-assets":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            filename = safe_filename(payload.get("filename"))
            data_url = payload.get("data", "")
            if not is_image_upload(filename, data_url):
                self.send_json(400, {"error": "Le fichier doit être une image."})
                return
            if "," in data_url:
                data_url = data_url.split(",", 1)[1]

            content = base64.b64decode(data_url)
            ASSETS.mkdir(exist_ok=True)
            target = unique_path(filename)
            target.write_bytes(content)

            path = target.relative_to(ROOT).as_posix()
            self.send_json(200, {
                "path": path,
                "type": mimetypes.guess_type(path)[0] or "application/octet-stream"
            })
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8000), AdminHandler)
    print("Admin server running on http://127.0.0.1:8000/admin.html")
    server.serve_forever()

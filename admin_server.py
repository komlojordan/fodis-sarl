import base64
import json
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
DATA = ROOT / "data"
PRODUCTS_JSON = DATA / "products.json"
SITE_INFO_JSON = DATA / "site_info.json"
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


def read_json_file(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json_file(path, payload):
    path.parent.mkdir(exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize_categories(value):
    if isinstance(value, list):
        source = value
    elif isinstance(value, str):
        source = value.replace("|", ",").replace(";", ",").split(",")
    else:
        source = []

    categories = []
    for item in source:
        clean = str(item).strip()
        if clean and clean.lower() not in [category.lower() for category in categories]:
            categories.append(clean)
    return categories


def validate_products(payload):
    if not isinstance(payload, list):
        raise ValueError("Le catalogue doit etre une liste de produits.")

    products = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Produit invalide a la ligne {index}.")

        product = dict(item)
        product["id"] = str(product.get("id") or f"produit-{index}").strip()
        product["name"] = str(product.get("name") or "").strip()
        product["category"] = normalize_categories(product.get("category") or product.get("categories"))
        product.pop("categories", None)
        if not product["name"] or not product["category"]:
            raise ValueError(f"Nom ou categorie manquant a la ligne {index}.")
        products.append(product)
    return products


class AdminHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if parsed.path in {"/assets-list", "/admin_assets.php"} and query.get("action", ["list"])[0] == "list":
            self.send_json(200, {"images": asset_images()})
            return
        if parsed.path in {"/site-info", "/admin_site_info.php"}:
            self.send_json(200, read_json_file(SITE_INFO_JSON, {}))
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        path = parsed.path

        if path == "/save-products":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                products = validate_products(payload)
                write_json_file(PRODUCTS_JSON, products)
                self.send_json(200, {"ok": True, "products": len(products)})
            except Exception as exc:
                self.send_json(400, {"error": str(exc)})
            return

        if path == "/site-info":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("Les informations du site doivent etre un objet JSON.")
                write_json_file(SITE_INFO_JSON, payload)
                self.send_json(200, {"ok": True})
            except Exception as exc:
                self.send_json(400, {"error": str(exc)})
            return

        is_upload = path == "/upload-assets" or (
            path == "/admin_assets.php" and query.get("action", [""])[0] == "upload"
        )
        if not is_upload:
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

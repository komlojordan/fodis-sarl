<?php
declare(strict_types=1);

$authFile = __DIR__ . DIRECTORY_SEPARATOR . 'admin_auth.php';
if (is_file($authFile)) {
    require $authFile;
    if (function_exists('fodis_require_admin_json')) {
        fodis_require_admin_json();
    }
}

header('Content-Type: application/json; charset=utf-8');

$root = __DIR__;
$assetsDir = $root . DIRECTORY_SEPARATOR . 'assets';
$imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'];

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function safe_filename(string $name): string
{
    $name = basename(rawurldecode($name ?: 'image'));
    $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', $name) ?: 'image.png';
    return trim($name, '.-') ?: 'image.png';
}

function unique_asset_path(string $assetsDir, string $filename): string
{
    $target = $assetsDir . DIRECTORY_SEPARATOR . $filename;
    if (!file_exists($target)) {
        return $target;
    }

    $info = pathinfo($filename);
    $stem = $info['filename'] ?? 'image';
    $extension = isset($info['extension']) ? '.' . $info['extension'] : '';
    $index = 2;

    do {
        $target = $assetsDir . DIRECTORY_SEPARATOR . $stem . '-' . $index . $extension;
        $index++;
    } while (file_exists($target));

    return $target;
}

function relative_asset_path(string $path): string
{
    return 'assets/' . basename($path);
}

function list_asset_images(string $assetsDir, array $imageExtensions): array
{
    if (!is_dir($assetsDir)) {
        return [];
    }

    $images = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($assetsDir, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if (!$file->isFile()) {
            continue;
        }

        $extension = strtolower($file->getExtension());
        if (!in_array($extension, $imageExtensions, true)) {
            continue;
        }

        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen(__DIR__) + 1));
        $images[] = $relative;
    }

    sort($images);
    return $images;
}

function data_url_to_bytes(string $dataUrl): ?string
{
    if (strpos($dataUrl, ',') !== false) {
        $dataUrl = explode(',', $dataUrl, 2)[1];
    }

    $bytes = base64_decode($dataUrl, true);
    return $bytes === false ? null : $bytes;
}

function detect_mime(string $bytes, string $filename): string
{
    $mime = '';
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->buffer($bytes) ?: '';
    }

    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($mime === 'text/plain' && $extension === 'svg') {
        $mime = 'image/svg+xml';
    }

    if ($mime === '') {
        $fallbacks = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'bmp' => 'image/bmp',
            'avif' => 'image/avif',
        ];
        $mime = $fallbacks[$extension] ?? '';
    }

    return $mime;
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    send_json(200, ['images' => list_asset_images($assetsDir, $imageExtensions)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || $action !== 'upload') {
    send_json(404, ['error' => 'Action introuvable.']);
}

$payload = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($payload)) {
    send_json(400, ['error' => 'Requete invalide.']);
}

$filename = safe_filename((string)($payload['filename'] ?? 'image'));
$extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$bytes = data_url_to_bytes((string)($payload['data'] ?? ''));

if ($bytes === null || $bytes === '') {
    send_json(400, ['error' => 'Image illisible.']);
}

if (!in_array($extension, $imageExtensions, true)) {
    send_json(400, ['error' => 'Le fichier doit etre une image.']);
}

$mime = detect_mime($bytes, $filename);
if (strpos($mime, 'image/') !== 0) {
    send_json(400, ['error' => 'Le fichier doit etre une image.']);
}

if (!is_dir($assetsDir) && !mkdir($assetsDir, 0755, true)) {
    send_json(500, ['error' => 'Impossible de creer le dossier assets.']);
}

if (!is_writable($assetsDir)) {
    send_json(500, ['error' => 'Le dossier assets nest pas accessible en ecriture.']);
}

$target = unique_asset_path($assetsDir, $filename);
if (file_put_contents($target, $bytes) === false) {
    send_json(500, ['error' => 'Impossible denregistrer limage.']);
}

send_json(200, [
    'path' => relative_asset_path($target),
    'type' => $mime,
]);

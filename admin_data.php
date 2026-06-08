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

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$productsFile = $dataDir . DIRECTORY_SEPARATOR . 'products.json';
$siteInfoFile = $dataDir . DIRECTORY_SEPARATOR . 'site_info.json';

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function normalize_categories($value): array
{
    $source = is_array($value) ? $value : preg_split('/[;,|]/', (string)$value);
    $categories = [];

    foreach ($source ?: [] as $item) {
        $clean = trim((string)$item);
        $exists = false;
        foreach ($categories as $category) {
            if (strtolower($category) === strtolower($clean)) {
                $exists = true;
                break;
            }
        }
        if ($clean !== '' && !$exists) {
            $categories[] = $clean;
        }
    }

    return $categories;
}

function validate_products($payload): array
{
    if (!is_array($payload)) {
        send_json(400, ['error' => 'Le catalogue doit etre une liste de produits.']);
    }

    $products = [];
    foreach ($payload as $index => $item) {
        if (!is_array($item)) {
            send_json(400, ['error' => 'Produit invalide a la ligne ' . ($index + 1) . '.']);
        }

        $product = $item;
        $product['id'] = trim((string)($product['id'] ?? ('produit-' . ($index + 1))));
        $product['name'] = trim((string)($product['name'] ?? ''));
        $product['category'] = normalize_categories($product['category'] ?? ($product['categories'] ?? []));
        unset($product['categories']);

        if ($product['name'] === '' || count($product['category']) === 0) {
            send_json(400, ['error' => 'Nom ou categorie manquant a la ligne ' . ($index + 1) . '.']);
        }

        $products[] = $product;
    }

    return $products;
}

function write_json_file(string $path, $payload): void
{
    if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0755, true)) {
        send_json(500, ['error' => 'Impossible de creer le dossier data.']);
    }

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false || file_put_contents($path, $json . PHP_EOL) === false) {
        send_json(500, ['error' => 'Impossible denregistrer le fichier.']);
    }
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'site-info') {
    $payload = is_file($siteInfoFile) ? json_decode(file_get_contents($siteInfoFile) ?: '{}', true) : [];
    send_json(200, is_array($payload) ? $payload : []);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(404, ['error' => 'Action introuvable.']);
}

$payload = json_decode(file_get_contents('php://input') ?: '', true);

if ($action === 'products') {
    $products = validate_products($payload);
    write_json_file($productsFile, $products);
    send_json(200, ['ok' => true, 'products' => count($products)]);
}

if ($action === 'site-info') {
    if (!is_array($payload)) {
        send_json(400, ['error' => 'Les informations du site doivent etre un objet JSON.']);
    }
    unset($payload['pw']);
    write_json_file($siteInfoFile, $payload);
    send_json(200, ['ok' => true]);
}

send_json(404, ['error' => 'Action introuvable.']);

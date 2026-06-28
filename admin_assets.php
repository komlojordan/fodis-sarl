<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$rootDir = __DIR__;
$uploadDir = $rootDir . '/assets/uploads';

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Impossible de créer le dossier des images']);
    exit;
}

if (!is_writable($uploadDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'Le dossier des images n’est pas accessible en écriture']);
    exit;
}

function sanitizeFilename($filename)
{
    $name = pathinfo($filename, PATHINFO_FILENAME);
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $name = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $name);
    $name = trim($name, "-._");
    if ($name === '') {
        $name = 'image';
    }
    $allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    if (!in_array($extension, $allowedExt, true)) {
        $extension = 'png';
    }
    return $name . '-' . time() . '-' . substr(md5($name . microtime()), 0, 8) . '.' . $extension;
}

function saveBase64Image($data, $filename)
{
    global $uploadDir;
    $imageData = $data;
    if (strpos($imageData, 'data:') === 0) {
        $parts = explode(',', $imageData, 2);
        if (count($parts) !== 2) {
            return false;
        }
        $imageData = $parts[1];
    }

    $decoded = base64_decode($imageData, true);
    if ($decoded === false) {
        return false;
    }

    $targetName = sanitizeFilename($filename);
    $targetPath = $uploadDir . '/' . $targetName;
    return file_put_contents($targetPath, $decoded) !== false ? 'assets/uploads/' . $targetName : false;
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    $images = [];
    $entries = scandir($uploadDir);
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $path = $uploadDir . '/' . $entry;
        if (is_file($path)) {
            $images[] = 'assets/uploads/' . $entry;
        }
    }
    sort($images);
    echo json_encode(['images' => $images]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'upload') {
    $input = file_get_contents('php://input');
    $payload = json_decode($input, true);

    if (!is_array($payload) || empty($payload['filename']) || empty($payload['data'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Payload invalide']);
        exit;
    }

    $savedPath = saveBase64Image($payload['data'], $payload['filename']);
    if ($savedPath === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Impossible d’enregistrer l’image']);
        exit;
    }

    echo json_encode(['success' => true, 'path' => $savedPath]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Méthode non supportée']);

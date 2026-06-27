<?php
// admin_data.php - Backend API pour synchroniser les données avec le serveur cloud

header('Content-Type: application/json');

// Configuration
$dataDir = __DIR__ . '/data';
$productsFile = $dataDir . '/products.json';
$siteInfoFile = $dataDir . '/site_info.json';

function readJsonFile($filePath, $fallback)
{
    if (!is_file($filePath)) {
        return $fallback;
    }

    $content = file_get_contents($filePath);
    if ($content === false) {
        return $fallback;
    }

    $data = json_decode($content, true);
    return json_last_error() === JSON_ERROR_NONE ? $data : $fallback;
}

// Vérifier les permissions
if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Impossible de créer le dossier data']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($data === null && $input !== '') {
        http_response_code(400);
        echo json_encode(['error' => 'JSON invalide']);
        exit;
    }

    $action = $_GET['action'] ?? 'products';

    if ($action === 'products') {
        // Sauvegarder les produits
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'Les données doivent être un tableau de produits']);
            exit;
        }

        if (file_put_contents($productsFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
            echo json_encode(['success' => true, 'message' => 'Produits sauvegardés']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Impossible de sauvegarder les produits']);
        }

    } elseif ($action === 'site-info') {
        // Sauvegarder les infos du site
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'Les données doivent être un objet']);
            exit;
        }

        if (file_put_contents($siteInfoFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
            echo json_encode(['success' => true, 'message' => 'Informations enregistrées']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Impossible de sauvegarder les infos']);
        }

    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Action inconnue']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'products';

    if ($action === 'products') {
        echo json_encode(readJsonFile($productsFile, []));
    } elseif ($action === 'site-info') {
        echo json_encode(readJsonFile($siteInfoFile, []));
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Action inconnue']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
}
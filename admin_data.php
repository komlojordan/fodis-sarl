<?php
// admin_data.php - Backend API pour synchroniser les données avec le serveur cloud

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

// Configuration
$dataDir = __DIR__ . '/data';
$productsFile = $dataDir . '/products.json';
$siteInfoFile = $dataDir . '/site_info.json';
$collectionsFile = $dataDir . '/data.json';

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

function writeJsonFile($filePath, $data)
{
    $dir = dirname($filePath);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return false;
    }
    if (!is_writable($dir)) {
        return false;
    }

    return file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getLastWriteError()
{
    $error = error_get_last();
    return $error && isset($error['message']) ? $error['message'] : 'Erreur inconnue';
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

        if (writeJsonFile($productsFile, $data)) {
            echo json_encode(['success' => true, 'message' => 'Produits sauvegardés']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Impossible de sauvegarder les produits', 'details' => getLastWriteError()]);
        }

    } elseif ($action === 'site-info') {
        // Sauvegarder les infos du site
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'Les données doivent être un objet']);
            exit;
        }

        if (writeJsonFile($siteInfoFile, $data)) {
            echo json_encode(['success' => true, 'message' => 'Informations enregistrées']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Impossible de sauvegarder les infos', 'details' => getLastWriteError()]);
        }
    } elseif ($action === 'collections') {
        // Sauvegarder les catégories et marques
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'Les données doivent être un objet']);
            exit;
        }

        $collections = [
            'categories' => is_array($data['categories']) ? array_values($data['categories']) : [],
            'brands' => is_array($data['brands']) ? array_values($data['brands']) : []
        ];

        if (writeJsonFile($collectionsFile, $collections)) {
            echo json_encode(['success' => true, 'message' => 'Collections sauvegardées']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Impossible de sauvegarder les collections', 'details' => getLastWriteError()]);
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
    } elseif ($action === 'collections') {
        echo json_encode(readJsonFile($collectionsFile, ['categories' => [], 'brands' => []]));
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Action inconnue']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
}
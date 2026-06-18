<?php
error_reporting(E_ALL & ~E_DEPRECATED);
header('Content-Type: application/json');
$cachePath = dirname(__DIR__, 2) . '/data/air-traffic-cache.json';
echo json_encode([
    'cachePath' => $cachePath,
    'cacheExists' => file_exists($cachePath),
    'cacheSize' => file_exists($cachePath) ? filesize($cachePath) : 0,
    'parentDir' => dirname(__DIR__, 2),
    'dataDirExists' => is_dir(dirname(__DIR__, 2) . '/data'),
]);

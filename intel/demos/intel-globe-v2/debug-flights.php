<?php
error_reporting(E_ALL & ~E_DEPRECATED);
header('Content-Type: application/json');
$cachePath = dirname(__DIR__) . '/data/air-traffic-cache.json';
echo json_encode([
    'cachePath' => $cachePath,
    'cacheExists' => file_exists($cachePath),
    'cacheSize' => file_exists($cachePath) ? filesize($cachePath) : 0,
    'dir' => __DIR__,
    'parentDir' => dirname(__DIR__),
    'dataDirExists' => is_dir(dirname(__DIR__) . '/data'),
    'dataDirContents' => array_slice(scandir(dirname(__DIR__) . '/data') ?: [], 0, 20),
]);

<?php
header('Content-Type: application/json');

// Test 1: cURL to a simple URL
$curlResult = 'not_tested';
if (function_exists('curl_init')) {
    $ch = curl_init('https://httpbin.org/json');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_USERAGENT => 'intel-globe-v2/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlResult = $raw ? "ok ($httpCode)" : "fail ($httpCode, " . curl_error($ch) . ")";
    curl_close($ch);
}

// Test 2: file_get_contents to a simple URL
$fopenResult = 'not_tested';
if (ini_get('allow_url_fopen')) {
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 10, 'header' => 'User-Agent: intel-globe-v2/1.0']]);
    $raw = @file_get_contents('https://httpbin.org/json', false, $ctx);
    $fopenResult = $raw ? 'ok' : 'fail';
}

// Test 3: cURL to OpenSky
$openskyResult = 'not_tested';
if (function_exists('curl_init')) {
    $ch = curl_init('https://opensky-network.org/api/states/all');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'intel-globe-v2/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $openskyResult = $raw ? "ok ($httpCode, " . strlen($raw) . " bytes)" : "fail ($httpCode, " . curl_error($ch) . ")";
    curl_close($ch);
}

echo json_encode([
    'curl_exists' => function_exists('curl_init'),
    'allow_url_fopen' => ini_get('allow_url_fopen'),
    'php_version' => PHP_VERSION,
    'curl_httpbin' => $curlResult,
    'fopen_httpbin' => $fopenResult,
    'curl_opensky' => $openskyResult,
]);

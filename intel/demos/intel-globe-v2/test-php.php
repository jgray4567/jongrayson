<?php
header('Content-Type: application/json');
echo json_encode([
  'curl_exists' => function_exists('curl_init'),
  'allow_url_fopen' => ini_get('allow_url_fopen'),
  'php_version' => PHP_VERSION,
  'curl_test' => 'not_tested'
]);

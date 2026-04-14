<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-signals.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];

$counts = [
    'acknowledge' => 0,
    'dismiss' => 0,
    'escalate' => 0,
    'new' => 0,
    'active' => 0
];

foreach ($payload['items'] ?? [] as $item) {
    $status = strtolower($item['status'] ?? 'new');
    if (isset($counts[$status])) {
        $counts[$status]++;
    }
}

echo json_encode([
    'acknowledge' => $counts['acknowledge'],
    'dismiss' => $counts['dismiss'],
    'escalate' => $counts['escalate'],
    'active' => $counts['new'] + $counts['active']
]);

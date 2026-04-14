<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$id = trim((string) ($input['id'] ?? ''));
$outcome = trim((string) ($input['outcome'] ?? '')); // 'positive', 'neutral', 'negative'

if ($id === '' || !in_array($outcome, ['positive', 'neutral', 'negative'])) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_payload']);
    exit;
}

$path = dirname(__DIR__) . '/data/intel-signals.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$payload['items'] = $payload['items'] ?? [];

foreach ($payload['items'] as &$item) {
    if (($item['id'] ?? '') === $id) {
        $item['escalationOutcome'] = $outcome;
        break;
    }
}
unset($item);

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo json_encode(['ok' => true]);

<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-analytics.json';
if (!file_exists($path)) {
    file_put_contents($path, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}

$payload = json_decode(file_get_contents($path), true);
if (!is_array($payload)) {
    $payload = ['items' => []];
}
if (!isset($payload['items']) || !is_array($payload['items'])) {
    $payload['items'] = [];
}

$input = json_decode(file_get_contents('php://input'), true);
$actions = array_values(array_unique(array_filter(array_map(function ($value) {
    return trim((string) $value);
}, $input['actions'] ?? []))));

if (!$actions) {
    http_response_code(400);
    echo json_encode(['error' => 'recommendation_actions_required']);
    exit;
}

foreach ($actions as $action) {
    $found = false;
    foreach ($payload['items'] as &$item) {
        if (($item['action'] ?? '') === $action) {
            $item['surfacedCount'] = intval($item['surfacedCount'] ?? 0) + 1;
            $item['lastSurfacedAt'] = gmdate('c');
            $found = true;
            break;
        }
    }
    unset($item);

    if (!$found) {
        $payload['items'][] = [
            'action' => $action,
            'acceptedCount' => 0,
            'surfacedCount' => 1,
            'lastAcceptedAt' => null,
            'lastSurfacedAt' => gmdate('c')
        ];
    }
}

usort($payload['items'], function ($a, $b) {
    return intval($b['acceptedCount'] ?? 0) <=> intval($a['acceptedCount'] ?? 0)
        ?: intval($b['surfacedCount'] ?? 0) <=> intval($a['surfacedCount'] ?? 0)
        ?: strcmp((string) ($b['lastAcceptedAt'] ?? ''), (string) ($a['lastAcceptedAt'] ?? ''));
});

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

echo json_encode(['ok' => true, 'items' => $payload['items']]);

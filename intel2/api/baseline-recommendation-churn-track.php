<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-churn.json';
if (!file_exists($path)) {
    file_put_contents($path, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}

$payload = json_decode(file_get_contents($path), true);
if (!is_array($payload)) $payload = ['items' => []];
if (!isset($payload['items']) || !is_array($payload['items'])) $payload['items'] = [];

$input = json_decode(file_get_contents('php://input'), true);
$items = is_array($input['items'] ?? null) ? $input['items'] : [];

foreach ($items as $incoming) {
    $action = trim((string) ($incoming['action'] ?? ''));
    $state = trim((string) ($incoming['promotion'] ?? 'default'));
    if ($action === '') continue;
    $found = false;
    foreach ($payload['items'] as &$item) {
        if (($item['action'] ?? '') === $action) {
            $previousState = $item['currentState'] ?? null;
            if ($previousState !== $state) {
                $item['previousState'] = $previousState;
                $item['currentState'] = $state;
                $item['changeCount'] = intval($item['changeCount'] ?? 0) + ($previousState === null ? 0 : 1);
                $item['lastChangedAt'] = gmdate('c');
            }
            $found = true;
            break;
        }
    }
    unset($item);

    if (!$found) {
        $payload['items'][] = [
            'action' => $action,
            'previousState' => null,
            'currentState' => $state,
            'changeCount' => 0,
            'lastChangedAt' => gmdate('c')
        ];
    }
}

usort($payload['items'], function ($a, $b) {
    return intval($b['changeCount'] ?? 0) <=> intval($a['changeCount'] ?? 0)
        ?: strcmp((string) ($b['lastChangedAt'] ?? ''), (string) ($a['lastChangedAt'] ?? ''));
});

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

echo json_encode(['ok' => true, 'items' => $payload['items']]);

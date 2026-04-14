<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-history.json';

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

$sortItems = function ($items) {
    usort($items, function ($a, $b) {
        return strcmp((string) ($b['recordedAt'] ?? ''), (string) ($a['recordedAt'] ?? ''));
    });
    return $items;
};

$writePayload = function ($nextPayload) use ($path) {
    file_put_contents($path, json_encode($nextPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
};

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    echo json_encode(['items' => $sortItems(array_values($payload['items']))]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $signature = trim((string) ($input['signature'] ?? ''));
    if ($signature === '') {
        http_response_code(400);
        echo json_encode(['error' => 'baseline_history_signature_required']);
        exit;
    }

    $item = [
        'signature' => $signature,
        'label' => trim((string) ($input['label'] ?? 'Steady')),
        'score' => intval($input['score'] ?? 0),
        'baselineLabel' => trim((string) ($input['baselineLabel'] ?? 'prior equivalent window')),
        'anchorTime' => trim((string) ($input['anchorTime'] ?? '')),
        'windowMinutes' => max(1, intval($input['windowMinutes'] ?? 60)),
        'severityFilter' => trim((string) ($input['severityFilter'] ?? '')),
        'sourceFilter' => trim((string) ($input['sourceFilter'] ?? '')),
        'recoveredFilter' => !empty($input['recoveredFilter']),
        'feedView' => trim((string) ($input['feedView'] ?? 'active')) ?: 'active',
        'baselineMode' => trim((string) ($input['baselineMode'] ?? 'previous')) ?: 'previous',
        'baselineViewId' => trim((string) ($input['baselineViewId'] ?? '')),
        'recordedAt' => trim((string) ($input['recordedAt'] ?? '')) ?: gmdate('c')
    ];

    $payload['items'] = array_values(array_filter($payload['items'], function ($existing) use ($signature) {
        return (string) ($existing['signature'] ?? '') !== $signature;
    }));

    array_unshift($payload['items'], $item);
    $payload['items'] = array_slice($payload['items'], 0, 25);
    $writePayload($payload);

    echo json_encode(['ok' => true, 'items' => $sortItems(array_values($payload['items']))]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method_not_allowed']);

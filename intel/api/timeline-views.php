<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/timeline-views.json';

if (!file_exists($path)) {
    file_put_contents($path, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

$payload = json_decode(file_get_contents($path), true);
if (!is_array($payload)) {
    $payload = ['items' => []];
}
if (!isset($payload['items']) || !is_array($payload['items'])) {
    $payload['items'] = [];
}

$writePayload = function ($nextPayload) use ($path) {
    file_put_contents($path, json_encode($nextPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
};

$sortItems = function ($items) {
    usort($items, function ($a, $b) {
        return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
    });
    return $items;
};

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    echo json_encode(['items' => $sortItems(array_values($payload['items']))]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim((string) ($input['name'] ?? ''));
    $anchorTime = trim((string) ($input['anchorTime'] ?? ''));
    $windowMinutes = max(1, intval($input['windowMinutes'] ?? 60));

    if ($name === '' || $anchorTime === '') {
        http_response_code(400);
        echo json_encode(['error' => 'timeline_view_name_and_anchor_required']);
        exit;
    }

    $item = [
        'id' => uniqid('timeline-view-', false),
        'name' => $name,
        'anchorTime' => $anchorTime,
        'windowMinutes' => $windowMinutes,
        'severityFilter' => trim((string) ($input['severityFilter'] ?? '')),
        'sourceFilter' => trim((string) ($input['sourceFilter'] ?? '')),
        'recoveredFilter' => !empty($input['recoveredFilter']),
        'feedView' => trim((string) ($input['feedView'] ?? 'active')) ?: 'active',
        'createdAt' => gmdate('c')
    ];

    $payload['items'][] = $item;
    $writePayload($payload);
    echo json_encode(['ok' => true, 'item' => $item, 'items' => $sortItems(array_values($payload['items']))]);
    exit;
}

if ($method === 'DELETE') {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['error' => 'timeline_view_id_required']);
        exit;
    }

    $before = count($payload['items']);
    $payload['items'] = array_values(array_filter($payload['items'], function ($item) use ($id) {
        return (string) ($item['id'] ?? '') !== $id;
    }));

    if (count($payload['items']) === $before) {
        http_response_code(404);
        echo json_encode(['error' => 'timeline_view_not_found']);
        exit;
    }

    $writePayload($payload);
    echo json_encode(['ok' => true, 'items' => $sortItems(array_values($payload['items']))]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method_not_allowed']);

<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-history.json';
$analyticsPath = dirname(__DIR__) . '/data/baseline-maintenance-analytics.json';
if (!file_exists($path)) {
    file_put_contents($path, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}
if (!file_exists($analyticsPath)) {
    file_put_contents($analyticsPath, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}

$payload = json_decode(file_get_contents($path), true);
if (!is_array($payload)) {
    $payload = ['items' => []];
}
if (!isset($payload['items']) || !is_array($payload['items'])) {
    $payload['items'] = [];
}

$analyticsPayload = json_decode(file_get_contents($analyticsPath), true);
if (!is_array($analyticsPayload)) {
    $analyticsPayload = ['items' => []];
}
if (!isset($analyticsPayload['items']) || !is_array($analyticsPayload['items'])) {
    $analyticsPayload['items'] = [];
}

$input = json_decode(file_get_contents('php://input'), true);
$action = trim((string) ($input['action'] ?? ''));
if ($action === '') {
    http_response_code(400);
    echo json_encode(['error' => 'maintenance_action_required']);
    exit;
}

$before = count($payload['items']);
$now = time();

if ($action === 'prune-flat-runs') {
    $payload['items'] = array_values(array_filter($payload['items'], function ($item) {
        return ($item['label'] ?? '') !== 'Steady';
    }));
} elseif ($action === 'archive-stale-history') {
    $payload['items'] = array_values(array_filter($payload['items'], function ($item) use ($now) {
        $ts = strtotime((string) ($item['recordedAt'] ?? ''));
        if (!$ts) return true;
        return ($now - $ts) <= (12 * 60 * 60);
    }));
} else {
    http_response_code(400);
    echo json_encode(['error' => 'unsupported_maintenance_action']);
    exit;
}

$removedCount = $before - count($payload['items']);

usort($payload['items'], function ($a, $b) {
    return strcmp((string) ($b['recordedAt'] ?? ''), (string) ($a['recordedAt'] ?? ''));
});

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

$tracked = false;
foreach ($analyticsPayload['items'] as &$item) {
    if (($item['action'] ?? '') === $action) {
        $item['count'] = intval($item['count'] ?? 0) + 1;
        $item['totalRemoved'] = intval($item['totalRemoved'] ?? 0) + $removedCount;
        $item['lastRemovedCount'] = $removedCount;
        $item['lastRunAt'] = gmdate('c');
        $tracked = true;
        break;
    }
}
unset($item);

if (!$tracked) {
    $analyticsPayload['items'][] = [
        'action' => $action,
        'count' => 1,
        'totalRemoved' => $removedCount,
        'lastRemovedCount' => $removedCount,
        'lastRunAt' => gmdate('c')
    ];
}

usort($analyticsPayload['items'], function ($a, $b) {
    return intval($b['count'] ?? 0) <=> intval($a['count'] ?? 0)
        ?: strcmp((string) ($b['lastRunAt'] ?? ''), (string) ($a['lastRunAt'] ?? ''));
});

file_put_contents($analyticsPath, json_encode($analyticsPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

echo json_encode([
    'ok' => true,
    'action' => $action,
    'removedCount' => $removedCount,
    'items' => $payload['items'],
    'analytics' => $analyticsPayload['items']
]);

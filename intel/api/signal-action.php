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
$action = trim((string) ($input['action'] ?? ''));

if ($id === '' || !in_array($action, ['acknowledge', 'dismiss', 'escalate', 'recover', 'convert'])) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_payload']);
    exit;
}

$path = dirname(__DIR__) . '/data/intel-signals.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$payload['items'] = $payload['items'] ?? [];
$signalToConvert = null;

foreach ($payload['items'] as &$item) {
    if (($item['id'] ?? '') === $id) {
        $previousStatus = strtolower((string) ($item['status'] ?? 'new'));
        $isActiveStatus = in_array($previousStatus, ['new', 'active'], true);

        $item['status'] = $action === 'recover' ? 'active' : ($action === 'convert' ? 'converted' : $action);
        $item['actionedAt'] = gmdate('c');

        if (in_array($action, ['acknowledge', 'dismiss', 'escalate'], true)) {
            if ($isActiveStatus) {
                $item['archiveCount'] = intval($item['archiveCount'] ?? 0) + 1;
            }
            $item['lastArchivedStatus'] = $action;
            $item['archivedAt'] = gmdate('c');
        }

        if ($action === 'recover') {
            $item['recoverCount'] = intval($item['recoverCount'] ?? 0) + 1;
            $item['archiveCount'] = max(intval($item['archiveCount'] ?? 0), intval($item['recoverCount'] ?? 0));
            $item['recoveredAt'] = gmdate('c');
        }

        if ($action === 'convert') {
            $signalToConvert = $item;
        }
        break;
    }
}
unset($item);

if ($signalToConvert) {
    $tasksPath = dirname(__DIR__) . '/data/intel-tasks.json';
    $tasksPayload = file_exists($tasksPath) ? json_decode(file_get_contents($tasksPath), true) : ['tasks' => []];
    $tasksPayload['tasks'][] = [
        'id' => 'task-' . uniqid(),
        'name' => 'Investigation: ' . ($signalToConvert['source'] ?? 'Unknown Source'),
        'status' => 'active',
        'tag' => 'Escalated Intelligence',
        'signalsAttached' => 1,
        'createdAt' => gmdate('c'),
        'convertedFromSignalId' => $id
    ];
    file_put_contents($tasksPath, json_encode($tasksPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo json_encode(['ok' => true]);

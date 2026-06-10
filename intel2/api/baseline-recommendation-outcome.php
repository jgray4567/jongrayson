<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/baseline-recommendation-outcomes.json';
$revivalPath = dirname(__DIR__) . '/data/baseline-recommendation-revivals.json';
if (!file_exists($path)) {
    file_put_contents($path, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}
if (!file_exists($revivalPath)) {
    file_put_contents($revivalPath, json_encode(['items' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}

$payload = json_decode(file_get_contents($path), true);
if (!is_array($payload)) {
    $payload = ['items' => []];
}
if (!isset($payload['items']) || !is_array($payload['items'])) {
    $payload['items'] = [];
}

$revivalPayload = json_decode(file_get_contents($revivalPath), true);
if (!is_array($revivalPayload)) {
    $revivalPayload = ['items' => []];
}
if (!isset($revivalPayload['items']) || !is_array($revivalPayload['items'])) {
    $revivalPayload['items'] = [];
}

$input = json_decode(file_get_contents('php://input'), true);
$action = trim((string) ($input['action'] ?? ''));
$outcome = trim((string) ($input['outcome'] ?? ''));

if ($action === '') {
    http_response_code(400);
    echo json_encode(['error' => 'recommendation_action_required']);
    exit;
}
if (!in_array($outcome, ['positive', 'neutral', 'negative'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'recommendation_outcome_required']);
    exit;
}

$key = $outcome . 'Count';
$found = false;
foreach ($payload['items'] as &$item) {
    if (($item['action'] ?? '') === $action) {
        $item['positiveCount'] = intval($item['positiveCount'] ?? 0);
        $item['neutralCount'] = intval($item['neutralCount'] ?? 0);
        $item['negativeCount'] = intval($item['negativeCount'] ?? 0);
        $item[$key] = intval($item[$key] ?? 0) + 1;
        $item['lastOutcome'] = $outcome;
        $item['lastOutcomeAt'] = gmdate('c');
        $found = true;
        break;
    }
}
unset($item);

if (!$found) {
    $payload['items'][] = [
        'action' => $action,
        'positiveCount' => $outcome === 'positive' ? 1 : 0,
        'neutralCount' => $outcome === 'neutral' ? 1 : 0,
        'negativeCount' => $outcome === 'negative' ? 1 : 0,
        'lastOutcome' => $outcome,
        'lastOutcomeAt' => gmdate('c')
    ];
}

usort($payload['items'], function ($a, $b) {
    $scoreA = intval($a['positiveCount'] ?? 0) - intval($a['negativeCount'] ?? 0);
    $scoreB = intval($b['positiveCount'] ?? 0) - intval($b['negativeCount'] ?? 0);
    return $scoreB <=> $scoreA
        ?: strcmp((string) ($b['lastOutcomeAt'] ?? ''), (string) ($a['lastOutcomeAt'] ?? ''));
});

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

$current = null;
foreach ($payload['items'] as $item) {
    if (($item['action'] ?? '') === $action) {
        $current = $item;
        break;
    }
}

$activeRevivalIndex = null;
foreach ($revivalPayload['items'] as $index => $item) {
    if (($item['action'] ?? '') === $action && ($item['status'] ?? '') === 'active') {
        $activeRevivalIndex = $index;
        break;
    }
}

$positiveCount = intval($current['positiveCount'] ?? 0);
$negativeCount = intval($current['negativeCount'] ?? 0);
$outcomeScore = $positiveCount - $negativeCount;

if ($outcome === 'positive' && $negativeCount >= 2 && $outcomeScore >= 0) {
    if ($activeRevivalIndex === null) {
        $revivalPayload['items'][] = [
            'action' => $action,
            'revivedAt' => gmdate('c'),
            'status' => 'active'
        ];
    } else {
        $revivalPayload['items'][$activeRevivalIndex]['status'] = 'sticking';
        $revivalPayload['items'][$activeRevivalIndex]['resolvedAt'] = gmdate('c');
    }
} elseif ($outcome === 'negative' && $activeRevivalIndex !== null) {
    $revivalPayload['items'][$activeRevivalIndex]['status'] = 'failed';
    $revivalPayload['items'][$activeRevivalIndex]['resolvedAt'] = gmdate('c');
}

usort($revivalPayload['items'], function ($a, $b) {
    return strcmp((string) ($b['revivedAt'] ?? ''), (string) ($a['revivedAt'] ?? ''));
});

file_put_contents($revivalPath, json_encode($revivalPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

echo json_encode(['ok' => true, 'items' => $payload['items'], 'revivals' => $revivalPayload['items']]);

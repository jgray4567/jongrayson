<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$topic = trim((string) ($input['topic'] ?? ''));
$suggestedQuery = trim((string) ($input['suggestedQuery'] ?? ''));
$thirdOrderEscalationAction = trim((string) ($input['thirdOrderEscalationAction'] ?? ''));

if ($topic === '' || $suggestedQuery === '' || $thirdOrderEscalationAction === '') {
    http_response_code(400);
    echo json_encode(['error' => 'third_order_escalation_payload_required']);
    exit;
}

$path = dirname(__DIR__) . '/data/intel-analytics.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];
$payload['items'] = $payload['items'] ?? [];
$matched = false;

foreach ($payload['items'] as &$item) {
    if (($item['topic'] ?? '') === $topic && ($item['suggestedQuery'] ?? '') === $suggestedQuery) {
        $item['thirdOrderEscalationAction'] = $thirdOrderEscalationAction;
        $item['thirdOrderEscalationAcceptCount'] = intval($item['thirdOrderEscalationAcceptCount'] ?? 0) + 1;
        $item['lastThirdOrderAcceptedAt'] = gmdate('c');
        $matched = true;
        break;
    }
}
unset($item);

if (!$matched) {
    $payload['items'][] = [
        'topic' => $topic,
        'suggestedQuery' => $suggestedQuery,
        'effectiveness' => 'mixed',
        'thirdOrderEscalationAction' => $thirdOrderEscalationAction,
        'thirdOrderEscalationAcceptCount' => 1,
        'lastThirdOrderEscalatedAt' => null,
        'lastThirdOrderAcceptedAt' => gmdate('c')
    ];
}

file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo json_encode(['ok' => true]);

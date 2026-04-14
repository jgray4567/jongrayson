<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-signals.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];

$recoveredSignals = 0;
$totalRecoveries = 0;
$archivedSignals = 0;
$archivedActionCount = 0;
$currentArchivedSignals = 0;

foreach ($payload['items'] ?? [] as $item) {
    $status = strtolower((string) ($item['status'] ?? 'new'));
    $count = intval($item['recoverCount'] ?? 0);
    $archiveCount = intval($item['archiveCount'] ?? 0);
    $isArchived = in_array($status, ['acknowledge', 'dismiss', 'escalate', 'converted'], true);

    if ($archiveCount < 1 && ($count > 0 || $isArchived)) {
        $archiveCount = $count + ($isArchived ? 1 : 0);
    }

    if ($archiveCount > 0) {
        $archivedSignals++;
        $archivedActionCount += $archiveCount;
    }

    if ($isArchived) {
        $currentArchivedSignals++;
    }

    if ($count > 0) {
        $recoveredSignals++;
        $totalRecoveries += $count;
    }
}

$recoveryRatePct = $archivedSignals > 0 ? round(($recoveredSignals / $archivedSignals) * 100, 1) : 0;

echo json_encode([
    'recoveredSignals' => $recoveredSignals,
    'totalRecoveries' => $totalRecoveries,
    'archivedSignals' => $archivedSignals,
    'archivedActionCount' => $archivedActionCount,
    'currentArchivedSignals' => $currentArchivedSignals,
    'recoveryRatePct' => $recoveryRatePct
]);

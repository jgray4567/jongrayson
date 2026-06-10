<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-tasks.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['tasks' => []];

$activeCount = 0;
$archivedCount = 0;
$convertedCount = 0;
$tags = [];

foreach ($payload['tasks'] ?? [] as $task) {
    if (($task['status'] ?? '') === 'active') {
        $activeCount++;
    } else {
        $archivedCount++;
    }
    
    if (!empty($task['convertedFromSignalId'])) {
        $convertedCount++;
    }
    
    $tag = $task['tag'] ?? 'Uncategorized';
    if (!isset($tags[$tag])) $tags[$tag] = 0;
    $tags[$tag]++;
}

$tagList = [];
foreach ($tags as $tag => $count) {
    $tagList[] = [
        'tag' => $tag,
        'count' => $count
    ];
}
usort($tagList, function($a, $b) {
    return $b['count'] <=> $a['count'] ?: strcmp($a['tag'], $b['tag']);
});

echo json_encode([
    'activeTasks' => $activeCount,
    'archivedTasks' => $archivedCount,
    'convertedFromSignals' => $convertedCount,
    'tags' => array_slice($tagList, 0, 5)
]);

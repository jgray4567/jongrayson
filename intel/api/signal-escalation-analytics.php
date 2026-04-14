<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$path = dirname(__DIR__) . '/data/intel-signals.json';
$payload = file_exists($path) ? json_decode(file_get_contents($path), true) : ['items' => []];

$counts = [];
foreach ($payload['items'] ?? [] as $item) {
    if (($item['status'] ?? '') === 'escalate') {
        $source = $item['source'] ?? 'Unknown';
        if (!isset($counts[$source])) {
            $counts[$source] = [
                'count' => 0,
                'positive' => 0,
                'neutral' => 0,
                'negative' => 0
            ];
        }
        $counts[$source]['count']++;

        $outcome = $item['escalationOutcome'] ?? '';
        if ($outcome === 'positive') $counts[$source]['positive']++;
        elseif ($outcome === 'negative') $counts[$source]['negative']++;
        elseif ($outcome === 'neutral') $counts[$source]['neutral']++;
    }
}

$items = [];
foreach ($counts as $source => $stats) {
    $netScore = $stats['positive'] - $stats['negative'];
    $items[] = [
        'source' => $source,
        'escalationCount' => $stats['count'],
        'positiveCount' => $stats['positive'],
        'neutralCount' => $stats['neutral'],
        'negativeCount' => $stats['negative'],
        'netScore' => $netScore
    ];
}

usort($items, function($a, $b) {
    $cmp = $b['netScore'] <=> $a['netScore'];
    if ($cmp !== 0) return $cmp;
    
    $cmp2 = $b['escalationCount'] <=> $a['escalationCount'];
    if ($cmp2 !== 0) return $cmp2;
    
    return strcmp($a['source'], $b['source']);
});

echo json_encode(['items' => $items]);

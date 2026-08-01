<?php
/**
 * city-news.php — headlines for a named place, for the city dossier.
 *
 * Source: Google News RSS search (keyless, public).
 *
 * GDELT's Doc API was tried first and rejected: its free-text relevance is
 * unusable at city granularity — "London" returned Canadian recipe columns,
 * "Sao Paulo" returned stories about Jammu. Google News search returns
 * genuinely on-topic, current results with named publishers.
 *
 * Honesty note carried through to the UI: this is a KEYWORD search, so it
 * returns articles *mentioning* the place, not necessarily reporting from it.
 * "Cairo" reliably surfaces both Cairo, Egypt and Cairo, Georgia. The client
 * labels the section accordingly rather than implying a local wire.
 */

header('Content-Type: application/json');
header('Cache-Control: public, max-age=900');

$city    = trim((string) ($_GET['city'] ?? ''));
$country = trim((string) ($_GET['country'] ?? ''));
$limit   = max(1, min(10, (int) ($_GET['limit'] ?? 5)));

if ($city === '' || !preg_match('/^[\p{L}\p{M}\s\.\'\-]{2,60}$/u', $city)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid or missing city', 'items' => []]);
    exit;
}

$cacheDir = dirname(__DIR__) . '/data/city-news';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0775, true);
$key = preg_replace('/[^a-z0-9]+/', '-', strtolower($city . '-' . $country));
$cachePath = $cacheDir . '/' . $key . '.json';
$cacheTtl = 900; // 15 min — city news moves slowly and this is per-city fan-out

if (file_exists($cachePath) && (time() - filemtime($cachePath)) < $cacheTtl) {
    echo file_get_contents($cachePath);
    exit;
}

// Pair the city with its country to disambiguate. Not a cure — "Cairo Egypt"
// still surfaces the odd Georgia story — but it lifts precision noticeably.
$query = $city . ($country !== '' ? ' ' . $country : '');
$url = 'https://news.google.com/rss/search?q=' . rawurlencode($query)
     . '&hl=en-US&gl=US&ceid=US:en';

$xml = null;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 9,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_ENCODING       => '',
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; intel-globe/2.0; +https://www.jongrayson.com)',
    ]);
    $xml = curl_exec($ch);
    if (curl_getinfo($ch, CURLINFO_HTTP_CODE) !== 200) $xml = null;
    if (PHP_VERSION_ID < 80000) curl_close($ch);
}

if (!$xml) {
    // Stale beats empty, but it must be labelled as stale.
    if (file_exists($cachePath)) {
        $old = json_decode(file_get_contents($cachePath), true) ?: [];
        $old['stale'] = true;
        echo json_encode($old, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(503);
    echo json_encode(['error' => 'news source unreachable', 'items' => [], 'city' => $city]);
    exit;
}

$prev = libxml_use_internal_errors(true);
$doc = simplexml_load_string($xml);
libxml_clear_errors();
libxml_use_internal_errors($prev);

$items = [];
if ($doc !== false && isset($doc->channel->item)) {
    foreach ($doc->channel->item as $n) {
        $title = trim((string) $n->title);
        if ($title === '') continue;

        // Google appends " - Publisher" to every title; the publisher is
        // already in <source>, so strip the duplicate.
        $source = trim((string) ($n->source ?? ''));
        if ($source !== '' && substr($title, -(strlen($source) + 3)) === ' - ' . $source) {
            $title = substr($title, 0, -(strlen($source) + 3));
        }

        $ts = strtotime((string) $n->pubDate) ?: time();
        if ($ts > time() + 3600) continue;   // never show future-dated items

        $items[] = [
            'title'  => html_entity_decode($title, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            'url'    => trim((string) $n->link),
            'source' => $source !== '' ? $source : 'Google News',
            'ts'     => $ts,
            'time'   => gmdate('H:i', $ts),
        ];
        if (count($items) >= $limit) break;
    }
}

$payload = [
    'city'      => $city,
    'country'   => $country,
    'query'     => $query,
    'fetchedAt' => time(),
    'count'     => count($items),
    'stale'     => false,
    'items'     => $items,
];
$json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
@file_put_contents($cachePath, $json);
echo $json;

<?php
/**
 * news-feed.php — live world/crisis headlines for the Intel Layer ticker.
 *
 * Replaces the hardcoded TICKER/ALERTS arrays that shipped in the demo. Those
 * were written copy with fixed timestamps that never aged — and because they
 * sat under a banner reading "LIVE FEED", linked to real news domains, and
 * were visually identical to the genuine USGS and NWS items beside them, they
 * were indistinguishable from real reporting. One of them cited
 * CVE-2026-4419, which does not exist in NVD.
 *
 * Sources are keyless, reputable, and public:
 *   BBC World, Al Jazeera, NPR World, ReliefWeb (UN humanitarian).
 *
 * Design rules:
 *  · Partial failure is fine — return whatever sources answered, and report
 *    which ones did in `sources`. The client shows real provenance.
 *  · Total failure returns stale cache if any exists, flagged `stale: true`.
 *    It NEVER invents an item. An empty ticker is correct when there is
 *    nothing to show; a fabricated one is not.
 */

header('Content-Type: application/json');
header('Cache-Control: public, max-age=300');

$cachePath = dirname(__DIR__) . '/data/news-feed-cache.json';
$cacheTtl  = 300; // 5 minutes

/**
 * Stale-while-revalidate.
 *
 * Any cached copy is served IMMEDIATELY, fresh or not, and the refresh then
 * happens after the response has been flushed to the client. A client request
 * must never block on an upstream fetch.
 *
 * This is not theoretical: outbound HTTP from this host degraded badly and a
 * single USGS fetch took 36 seconds, which made every endpoint that fetched
 * synchronously time out and took the whole dashboard's layers down with it.
 * Serving 5-minute-old headlines instantly is strictly better than serving
 * nothing after 30 seconds — and the payload carries `ageSeconds` so the UI
 * can say exactly how old it is.
 */
require_once __DIR__ . '/swr.php';
if (!swr_serve($cachePath, $cacheTtl)) exit;   // cache served; done

$FEEDS = [
    ['name' => 'BBC World',   'url' => 'https://feeds.bbci.co.uk/news/world/rss.xml'],
    ['name' => 'Al Jazeera',  'url' => 'https://www.aljazeera.com/xml/rss/all.xml'],
    ['name' => 'NPR World',   'url' => 'https://feeds.npr.org/1004/rss.xml'],
    ['name' => 'ReliefWeb',   'url' => 'https://reliefweb.int/updates/rss.xml'],
];

$UA = 'Mozilla/5.0 (compatible; intel-globe/2.0; +https://www.jongrayson.com)';

/** Fetch all feeds in parallel. Returns [name => body|null]. */
function fetch_all(array $feeds, string $ua): array {
    $out = [];
    if (!function_exists('curl_multi_init')) {
        foreach ($feeds as $f) {
            // Sequential fallback: 4 feeds x 8s could reach 32s on its own,
            // which is longer than most client timeouts. Keep the whole pass
            // bounded well under that.
            $ctx = stream_context_create(['http' => [
                'timeout' => 4, 'header' => "User-Agent: {$ua}\r\n", 'ignore_errors' => true,
            ]]);
            $out[$f['name']] = @file_get_contents($f['url'], false, $ctx) ?: null;
        }
        return $out;
    }

    $mh = curl_multi_init();
    $handles = [];
    foreach ($feeds as $f) {
        $ch = curl_init($f['url']);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_USERAGENT      => $ua,
            CURLOPT_ENCODING       => '',
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$f['name']] = $ch;
    }
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 1.0);
    } while ($running > 0);

    foreach ($handles as $name => $ch) {
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $body = curl_multi_getcontent($ch);
        $out[$name] = ($code === 200 && $body) ? $body : null;
        curl_multi_remove_handle($mh, $ch);
        if (PHP_VERSION_ID < 80000) curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}

/** Parse RSS 2.0 or Atom into normalised items. */
function parse_feed(string $xml, string $sourceName): array {
    $items = [];
    $prev = libxml_use_internal_errors(true);
    $doc = simplexml_load_string($xml);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    if ($doc === false) return $items;

    $nodes = [];
    if (isset($doc->channel->item))  $nodes = $doc->channel->item;   // RSS 2.0
    elseif (isset($doc->item))       $nodes = $doc->item;            // RDF
    elseif (isset($doc->entry))      $nodes = $doc->entry;           // Atom

    foreach ($nodes as $n) {
        $title = trim((string) ($n->title ?? ''));
        if ($title === '') continue;

        // Atom <link href="…"> vs RSS <link>text</link>
        $link = trim((string) ($n->link ?? ''));
        if ($link === '' && isset($n->link['href'])) $link = trim((string) $n->link['href']);
        if ($link === '') continue;

        $dateRaw = (string) ($n->pubDate ?? $n->published ?? $n->updated ?? '');
        $ts = $dateRaw ? strtotime($dateRaw) : false;
        if ($ts === false) $ts = time();

        // Drop anything implausibly future-dated — the exact failure mode of
        // the hardcoded items this endpoint replaces.
        if ($ts > time() + 3600) continue;

        $items[] = [
            'title'  => html_entity_decode($title, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            'url'    => $link,
            'source' => $sourceName,
            'ts'     => $ts,
        ];
    }
    return $items;
}

/** Crude topical tag, used only to colour the ticker dot. */
function categorise(string $title): string {
    $t = strtolower($title);
    // 'drone' deliberately excluded: commercial drone stories (delivery,
    // racing, inspection) are common and tagging them conflict paints a
    // reserved-red dot on a benign headline. Red is for threat to life.
    $conflict = ['strike','missile','troops','military','war','offensive','shelling',
                 'airstrike','ceasefire','armed','rebel','insurg','warplane','combat'];
    $crisis   = ['refugee','famine','displaced','humanitarian','aid','flood','earthquake',
                 'cyclone','hurricane','wildfire','outbreak','epidemic','evacuat','disaster'];
    $security = ['cyber','hack','breach','ransomware','sanction','espionage','malware'];
    foreach ($conflict as $k) if (strpos($t, $k) !== false) return 'conflict';
    foreach ($crisis   as $k) if (strpos($t, $k) !== false) return 'crisis';
    foreach ($security as $k) if (strpos($t, $k) !== false) return 'security';
    return 'general';
}

// ── Fetch, parse, merge ──
$bodies  = fetch_all($FEEDS, $UA);
$items   = [];
$okList  = [];
$failed  = [];

foreach ($FEEDS as $f) {
    $body = $bodies[$f['name']] ?? null;
    if (!$body) { $failed[] = $f['name']; continue; }
    $parsed = parse_feed($body, $f['name']);
    if (!$parsed) { $failed[] = $f['name']; continue; }
    $okList[] = $f['name'];
    $items = array_merge($items, $parsed);
}

// ── Total failure: serve stale cache rather than nothing, and say so ──
if (!$items) {
    if (file_exists($cachePath)) {
        $stale = json_decode(file_get_contents($cachePath), true) ?: [];
        $stale['stale'] = true;
        $stale['error'] = 'all upstream sources unreachable; serving last good data';
        $stale['sources'] = ['ok' => [], 'failed' => $failed];
        echo json_encode($stale, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(503);
    echo json_encode([
        'error'   => 'all upstream news sources unreachable',
        'items'   => [],
        'sources' => ['ok' => [], 'failed' => $failed],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

// De-duplicate on normalised title (the same story runs on several wires).
$seen = [];
$unique = [];
foreach ($items as $it) {
    $k = preg_replace('/[^a-z0-9]+/', '', strtolower($it['title']));
    $k = substr($k, 0, 60);
    if ($k === '' || isset($seen[$k])) continue;
    $seen[$k] = true;
    $unique[] = $it;
}

usort($unique, fn($a, $b) => $b['ts'] <=> $a['ts']);
$unique = array_slice($unique, 0, 40);

foreach ($unique as &$it) {
    $it['category'] = categorise($it['title']);
    $it['time']     = gmdate('H:i', $it['ts']);
}
unset($it);

$payload = [
    'fetchedAt' => time(),
    'count'     => count($unique),
    'stale'     => false,
    'sources'   => ['ok' => $okList, 'failed' => $failed],
    'items'     => $unique,
];

$payload['parallel'] = function_exists('curl_multi_init');
$json = swr_store($cachePath, $payload);

// A refresh run has no caller waiting on it — the cache is the product.
if (swr_is_refresh_run()) exit;
echo $json;

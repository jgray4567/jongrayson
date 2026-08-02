<?php
/**
 * trends-feed.php — Google Trends daily search trends for a country.
 *
 * Adds a signal type the dashboard did not previously have. Wire services
 * report what editors have decided is news; trending searches show what the
 * public is actually looking up, which often moves first — an earthquake, an
 * outage or an incident spikes in search before it is filed as a story.
 *
 * Endpoint: https://trends.google.com/trending/rss?geo=XX
 * (Keyless. The older /trendingsearches/daily/rss and /hottrends/atom paths
 * are both 404 as of 2026 — verified — so do not "restore" them.)
 *
 * Honesty notes carried to the UI:
 *  · Trends are COUNTRY-level. A city dossier showing them is showing the
 *    country's trends, and says so — not that city's.
 *  · Coverage is not universal. China returns nothing because Google is
 *    blocked there; that is reported as "no coverage", never as "no activity".
 *    Those are completely different facts.
 */

header('Content-Type: application/json');
header('Cache-Control: public, max-age=900');

/** Country name (as used in the globe's CITIES table) → ISO-3166-1 alpha-2. */
$GEO = [
  'USA'=>'US','UK'=>'GB','Japan'=>'JP','France'=>'FR','Germany'=>'DE','India'=>'IN',
  'Brazil'=>'BR','Russia'=>'RU','China'=>'CN','Egypt'=>'EG','Nigeria'=>'NG',
  'S.Africa'=>'ZA','Australia'=>'AU','Mexico'=>'MX','S.Korea'=>'KR','Turkey'=>'TR',
  'Indonesia'=>'ID','Argentina'=>'AR','Spain'=>'ES','Italy'=>'IT','Canada'=>'CA',
  'Austria'=>'AT','Greece'=>'GR','Iran'=>'IR','Iraq'=>'IQ','Ireland'=>'IE',
  'Israel'=>'IL','Kenya'=>'KE','Netherlands'=>'NL','Pakistan'=>'PK',
  'Philippines'=>'PH','Portugal'=>'PT','S.Arabia'=>'SA','Singapore'=>'SG',
  'Sweden'=>'SE','Taiwan'=>'TW','Thailand'=>'TH','UAE'=>'AE','Vietnam'=>'VN',
  // Beyond the CITIES table — hotspots, search results and future cities can
  // reference these, and an unmapped country reports "unknown" rather than
  // simply having no trends.
  'Ukraine'=>'UA','Poland'=>'PL','Belgium'=>'BE','Switzerland'=>'CH',
  'Norway'=>'NO','Denmark'=>'DK','Finland'=>'FI','Czechia'=>'CZ',
  'Romania'=>'RO','Hungary'=>'HU','Colombia'=>'CO','Chile'=>'CL',
  'Peru'=>'PE','Venezuela'=>'VE','Malaysia'=>'MY','Bangladesh'=>'BD',
  'Morocco'=>'MA','Ethiopia'=>'ET','Ghana'=>'GH','Tanzania'=>'TZ',
  'New Zealand'=>'NZ','Sudan'=>'SD','Syria'=>'SY','Jordan'=>'JO',
  'Lebanon'=>'LB','Qatar'=>'QA','Kuwait'=>'KW','Kazakhstan'=>'KZ',
];

// Verified as returning nothing. Reported honestly rather than as silence.
$NO_COVERAGE = ['CN' => 'Google is blocked in mainland China; Trends has no data for this country.'];

$geo     = strtoupper(trim((string) ($_GET['geo'] ?? '')));
$country = trim((string) ($_GET['country'] ?? ''));
$limit   = max(1, min(10, (int) ($_GET['limit'] ?? 5)));

if ($geo === '' && $country !== '' && isset($GEO[$country])) $geo = $GEO[$country];
if (!preg_match('/^[A-Z]{2}$/', $geo)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'unknown country or geo',
        'country' => $country, 'items' => [], 'covered' => false,
    ]);
    exit;
}

if (isset($NO_COVERAGE[$geo])) {
    echo json_encode([
        'geo' => $geo, 'country' => $country, 'covered' => false,
        'reason' => $NO_COVERAGE[$geo], 'count' => 0, 'items' => [],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$cacheDir = dirname(__DIR__) . '/data/trends';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0775, true);
$cachePath = $cacheDir . '/' . $geo . '.json';
$cacheTtl = 900; // 15 min — Google refreshes these on roughly that cadence

$cached = file_exists($cachePath) ? file_get_contents($cachePath) : null;
$cacheAge = $cached !== null ? (time() - filemtime($cachePath)) : null;
if ($cached !== null) {
    $out = json_decode($cached, true) ?: [];
    $out['ageSeconds'] = $cacheAge;
    $out['stale'] = $cacheAge >= $cacheTtl;
    echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($cacheAge < $cacheTtl) exit;
    // Expired: respond first, refresh after. A client must never wait on an
    // upstream fetch — see the note in news-feed.php.
    if (function_exists('fastcgi_finish_request')) { fastcgi_finish_request(); }
    else { ignore_user_abort(true); @ob_end_flush(); @flush(); }
    $lock = $cachePath . '.lock';
    if (file_exists($lock) && (time() - filemtime($lock)) < 120) exit;
    @touch($lock);
    $REFRESH_ONLY = true;
}

$xml = null;
if (function_exists('curl_init')) {
    $ch = curl_init('https://trends.google.com/trending/rss?geo=' . $geo);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_ENCODING       => '',
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; intel-globe/2.0; +https://www.jongrayson.com)',
    ]);
    $xml = curl_exec($ch);
    if (curl_getinfo($ch, CURLINFO_HTTP_CODE) !== 200) $xml = null;
    if (PHP_VERSION_ID < 80000) curl_close($ch);
}

if (!$xml) {
    if (file_exists($cachePath)) {
        $old = json_decode(file_get_contents($cachePath), true) ?: [];
        $old['stale'] = true;
        echo json_encode($old, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(503);
    echo json_encode(['error' => 'trends source unreachable', 'geo' => $geo, 'items' => [], 'covered' => true]);
    exit;
}

$prev = libxml_use_internal_errors(true);
$doc = simplexml_load_string($xml);
libxml_clear_errors();
libxml_use_internal_errors($prev);

$items = [];
if ($doc !== false && isset($doc->channel->item)) {
    $ns = 'https://trends.google.com/trending/rss';
    foreach ($doc->channel->item as $n) {
        $term = trim((string) $n->title);
        if ($term === '') continue;
        $ht = $n->children($ns);

        $traffic = trim((string) ($ht->approx_traffic ?? ''));
        $newsTitle = '';
        $newsUrl = '';
        $newsSource = '';
        if (isset($ht->news_item)) {
            $first = $ht->news_item[0];
            $fh = $first->children($ns);
            $newsTitle  = trim((string) ($fh->news_item_title ?? ''));
            $newsUrl    = trim((string) ($fh->news_item_url ?? ''));
            $newsSource = trim((string) ($fh->news_item_source ?? ''));
        }

        $ts = strtotime((string) $n->pubDate) ?: time();

        $items[] = [
            'term'       => html_entity_decode($term, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            'traffic'    => $traffic,
            // Numeric form for sorting/bar widths; "200+" / "2K+" / "1M+".
            'trafficNum' => (function ($t) {
                if (!preg_match('/([\d.]+)\s*([KMB]?)/i', $t, $m)) return 0;
                $mult = ['' => 1, 'K' => 1e3, 'M' => 1e6, 'B' => 1e9];
                return (int) ((float) $m[1] * ($mult[strtoupper($m[2])] ?? 1));
            })($traffic),
            'newsTitle'  => html_entity_decode($newsTitle, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            'newsUrl'    => $newsUrl,
            'newsSource' => $newsSource,
            'url'        => 'https://trends.google.com/trends/explore?q=' . rawurlencode($term) . '&geo=' . $geo,
            'ts'         => $ts,
        ];
        if (count($items) >= $limit) break;
    }
}

$payload = [
    'geo'       => $geo,
    'country'   => $country,
    'covered'   => true,
    'fetchedAt' => time(),
    'count'     => count($items),
    'stale'     => false,
    'items'     => $items,
];
$payload['ageSeconds'] = 0;
$json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
@file_put_contents($cachePath, $json);
@unlink($cachePath . '.lock');
if (!empty($REFRESH_ONLY)) exit;
echo $json;

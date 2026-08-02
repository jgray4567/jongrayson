<?php
/**
 * swr.php — stale-while-revalidate helper shared by the feed endpoints.
 *
 * Why this exists
 * ---------------
 * The dashboard went dark when outbound HTTP from this host degraded: a single
 * USGS fetch took 36 seconds and a four-feed endpoint stopped responding
 * altogether. Every endpoint made the browser wait on that upstream call, so an
 * upstream slowdown became a total outage.
 *
 * The first fix tried `fastcgi_finish_request()` with an
 * `ignore_user_abort()` + `flush()` fallback. That does NOT close the
 * connection on this host's PHP SAPI — the client still waits for the script to
 * end, so the refresh kept blocking and the endpoints still timed out.
 *
 * This version does not depend on flush semantics at all:
 *
 *   · A cached copy is ALWAYS returned immediately, fresh or stale, tagged with
 *     `ageSeconds` and `stale` so the UI can state its age.
 *   · When the cache is stale, a detached self-request (`?__refresh=1`) is
 *     fired with a ~300 ms timeout. We abandon the connection; PHP on the other
 *     end sets ignore_user_abort() and finishes the real work regardless.
 *   · Only a completely cold cache does a bounded synchronous fetch, so the
 *     very first request still works.
 *   · A lock file stops concurrent callers stampeding the upstream.
 *
 * Net effect: a client request costs one file read. Upstream latency can no
 * longer take the dashboard down.
 */

function swr_is_refresh_run(): bool {
    return isset($_GET['__refresh']);
}

/** Called at the top of a refresh run so it survives the caller hanging up. */
function swr_begin_refresh(): void {
    ignore_user_abort(true);
    @set_time_limit(60);
}

function swr_lock_path(string $cachePath): string { return $cachePath . '.lock'; }

function swr_lock_held(string $cachePath, int $ttl = 120): bool {
    $l = swr_lock_path($cachePath);
    return file_exists($l) && (time() - filemtime($l)) < $ttl;
}
function swr_take_lock(string $cachePath): void { @touch(swr_lock_path($cachePath)); }
function swr_release_lock(string $cachePath): void { @unlink(swr_lock_path($cachePath)); }

/**
 * DISABLED — kept only so the ?__refresh=1 path stays documented.
 *
 * This used to fire a detached self-request whenever the cache was stale.
 * It made things far worse: each trigger spawned another PHP worker that ran
 * for up to 60s doing slow upstream fetches, and this host has a small worker
 * pool. Measured during the incident, signal-feed.php — a local file read with
 * no outbound calls at all — took 20s and then 12s to respond purely from
 * queueing. Client requests must not spawn work on this host.
 *
 * Refreshes now come from exactly two places: a cold cache (once), and an
 * explicit ?__refresh=1 request, which is what a cron job should call.
 */
function swr_trigger_refresh_DISABLED(string $cachePath): void {
    if (swr_lock_held($cachePath)) return;
    swr_take_lock($cachePath);

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'www.jongrayson.com';
    $uri    = $_SERVER['REQUEST_URI'] ?? '';
    $sep    = (strpos($uri, '?') === false) ? '?' : '&';
    $url    = $scheme . '://' . $host . $uri . $sep . '__refresh=1';

    if (!function_exists('curl_init')) { swr_release_lock($cachePath); return; }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT_MS     => 300,   // hang up almost immediately
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_NOSIGNAL       => 1,
        CURLOPT_FRESH_CONNECT  => true,
        CURLOPT_USERAGENT      => 'intel-globe-swr/1.0',
    ]);
    curl_exec($ch);                      // expected to time out — that is fine
    if (PHP_VERSION_ID < 80000) curl_close($ch);
}

/**
 * Serve the cache and decide what happens next.
 * Returns true when the caller should CONTINUE and do a real fetch.
 */
function swr_serve(string $cachePath, int $cacheTtl): bool {
    $isRefresh = swr_is_refresh_run();
    if ($isRefresh) { swr_begin_refresh(); return true; }

    if (!file_exists($cachePath)) return true;   // cold: fetch synchronously

    $age  = time() - filemtime($cachePath);
    $body = file_get_contents($cachePath);
    $out  = json_decode($body, true) ?: [];
    $out['ageSeconds'] = $age;
    $out['stale']      = $age >= $cacheTtl;
    echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    // Deliberately NO refresh here. Serving slightly stale data instantly is
    // the correct trade; spawning work per request took the whole site down.
    // `stale: true` is already on the payload, and the UI reports the age.
    return false;                                 // response already sent
}

/** Write the cache at the end of a real fetch. */
function swr_store(string $cachePath, array $payload): string {
    $payload['ageSeconds'] = 0;
    $payload['stale'] = false;
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    @file_put_contents($cachePath, $json);
    swr_release_lock($cachePath);
    return $json;
}

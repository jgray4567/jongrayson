<?php
/**
 * Live Feeds Proxy for Intel Globe
 * 
 * Proxies external API requests to avoid CORS issues.
 * Usage: live-feeds.php?source=earthquakes|weather|storms|cameras
 * 
 * Sources:
 *   - earthquakes: USGS all_day GeoJSON feed
 *   - weather: NWS active alerts (all)
 *   - storms: NWS active alerts (storm-related only)
 *   - cameras: NYC DOT traffic cameras list
 *   - camera-image: NYC DOT camera image (requires &id=NNN)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$source = isset($_GET['source']) ? $_GET['source'] : '';

// Cache directory (auto-created)
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

/**
 * Fetch URL with cURL, return body + status code.
 */
function fetchUrl($url, $timeout = 15) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_USERAGENT => 'IntelGlobe/2.0 (jongrayson.com intel globe)',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$body, $status, $err];
}

/**
 * Get cached data or fetch fresh. Cache for N seconds.
 */
function getCachedOrFetch($url, $cacheFile, $maxAge, $timeout = 15) {
    $cachePath = $GLOBALS['cacheDir'] . '/' . $cacheFile;
    
    // Check cache
    if (file_exists($cachePath)) {
        $age = time() - filemtime($cachePath);
        if ($age < $maxAge) {
            $cached = file_get_contents($cachePath);
            if ($cached !== false) {
                $data = json_decode($cached, true);
                if ($data !== null) {
                    $data['_cached'] = true;
                    $data['_cache_age'] = $age;
                    return $data;
                }
            }
        }
    }
    
    // Fetch fresh
    list($body, $status, $err) = fetchUrl($url, $timeout);
    
    if ($err || $status >= 400 || $body === false) {
        // Return cached data if available, even if stale
        if (file_exists($cachePath)) {
            $cached = file_get_contents($cachePath);
            if ($cached !== false) {
                $data = json_decode($cached, true);
                if ($data !== null) {
                    $data['_cached'] = true;
                    $data['_stale'] = true;
                    return $data;
                }
            }
        }
        http_response_code($status ?: 500);
        return ['error' => 'Fetch failed', 'status' => $status, 'detail' => $err];
    }
    
    // Save cache
    @file_put_contents($cachePath, $body);
    
    $data = json_decode($body, true);
    if ($data === null) {
        // Return raw body if not JSON
        return ['raw' => $body];
    }
    
    $data['_cached'] = false;
    return $data;
}

switch ($source) {
    case 'earthquakes':
        // USGS — all earthquakes in past 24 hours
        $url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
        $data = getCachedOrFetch($url, 'earthquakes.json', 300); // 5 min cache
        echo json_encode($data);
        break;
    
    case 'weather':
        // NWS — all active alerts
        $url = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert';
        $data = getCachedOrFetch($url, 'weather_alerts.json', 300); // 5 min cache
        echo json_encode($data);
        break;
    
    case 'storms':
        // NWS — storm-related alerts only
        $url = 'https://api.weather.gov/alerts/active?event=Storm%20Warning,Storm%20Watch,Severe%20Thunderstorm%20Warning,Tornado%20Warning,Tornado%20Watch,Hurricane%20Warning,Hurricane%20Watch';
        $data = getCachedOrFetch($url, 'storm_alerts.json', 300); // 5 min cache
        echo json_encode($data);
        break;
    
    case 'cameras':
        // NYC DOT — traffic camera list
        $url = 'https://webcams.nyctmc.org/api/cameras';
        $data = getCachedOrFetch($url, 'nyc_cameras.json', 600); // 10 min cache
        echo json_encode($data);
        break;
    
    case 'camera-image':
        // NYC DOT — single camera image (proxied as JPEG)
        $camId = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id']) : '';
        if (!$camId) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing camera id']);
            exit;
        }
        $url = "https://webcams.nyctmc.org/api/cameras/{$camId}/image";
        
        // Check image cache (1 min)
        $imgCachePath = $cacheDir . '/cam_' . $camId . '.jpg';
        if (file_exists($imgCachePath)) {
            $age = time() - filemtime($imgCachePath);
            if ($age < 60) {
                header('Content-Type: image/jpeg');
                header('Cache-Control: public, max-age=60');
                readfile($imgCachePath);
                exit;
            }
        }
        
        // Fetch image
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_USERAGENT => 'IntelGlobe/2.0',
        ]);
        $imgData = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);
        
        if ($imgData && $status < 400) {
            @file_put_contents($imgCachePath, $imgData);
            header('Content-Type: ' . ($contentType ?: 'image/jpeg'));
            header('Cache-Control: public, max-age=60');
            echo $imgData;
        } else {
            http_response_code($status ?: 500);
            echo json_encode(['error' => 'Image fetch failed', 'status' => $status]);
        }
        exit;
    
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown source', 'available' => ['earthquakes', 'weather', 'storms', 'cameras', 'camera-image']]);
        break;
}
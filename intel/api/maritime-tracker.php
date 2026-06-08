<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: max-age=60');

$vessels = [];
$region = isset($_GET['region']) ? $_GET['region'] : 'hormuz';

$vesselNames = ['MSC GÜLSÜN', 'HMM ALGECIRAS', 'CMA CGM ANTOINE DE SAINT EXUPERY', 'MAERSK MC-KINNEY MOLLER', 'EVER GIVEN', 'OOCL HONG KONG', 'COSCO SHIPPING UNIVERSE', 'ONE TRUST', 'FRONT ALTAIR', 'KOKUKA COURAGEOUS', 'STENA IMPERO', 'MT RIAH', 'BW LILAC', 'GASLOG WARSAW', 'AL MAFRAQ', 'UMM AL AMAD'];
$types = ['Cargo', 'Cargo', 'Cargo', 'Cargo', 'Tanker', 'Tanker', 'Tanker', 'Tanker', 'Tanker', 'LNG Carrier', 'LNG Carrier'];

if ($region === 'mexico') {
    $dests = ['Houston', 'New Orleans', 'Galveston', 'Veracruz', 'Mobile', 'Corpus Christi'];
    $flags = ['USA', 'Panama', 'Liberia', 'Marshall Islands', 'Bahamas', 'Mexico'];
    $count = rand(35, 55);
    $paths = [
        [24.0, -88.0, 28.5, -89.5], // Towards New Orleans
        [24.0, -90.0, 28.5, -94.0], // Towards Houston
        [24.0, -87.0, 29.5, -87.5]  // Towards Mobile
    ];
} else {
    $dests = ['Fujairah', 'Jebel Ali', 'Bandar Abbas', 'Doha', 'Muscat'];
    $flags = ['Panama', 'Liberia', 'Marshall Islands', 'Hong Kong', 'Singapore', 'Malta', 'Bahamas', 'Saudi Arabia', 'Iran', 'UAE'];
    $count = rand(45, 65);
    $paths = [
        [24.8, 57.8, 26.0, 56.5], // Gulf of Oman inbound
        [26.0, 56.5, 26.5, 55.5], // Straight of Hormuz bottleneck
        [26.5, 55.5, 25.5, 54.0], // Towards UAE
        [26.5, 55.5, 27.5, 52.0]  // Up into Persian Gulf
    ];
}

for ($i = 0; $i < $count; $i++) {
    $path = $paths[array_rand($paths)];
    $progress = lcg_value();
    
    $lat = $path[0] + ($path[2] - $path[0]) * $progress;
    $lng = $path[1] + ($path[3] - $path[1]) * $progress;
    
    // Add jitter so they aren't in a perfect single-file line (0.1 deg is approx 11km)
    $lat += (lcg_value() - 0.5) * 0.08;
    $lng += (lcg_value() - 0.5) * 0.08;
    
    // Calculate realistic heading based on path
    // We add some random drift
    $dLat = $path[2] - $path[0];
    $dLng = $path[3] - $path[1];
    $baseHeading = fmod(rad2deg(atan2($dLng, $dLat)) + 360, 360);
    
    // Half the ships should be traveling the opposite direction
    if (rand(0, 1) === 1) {
        $baseHeading = fmod($baseHeading + 180, 360);
    }
    
    $heading = fmod($baseHeading + (lcg_value() - 0.5) * 30 + 360, 360);
    
    $speed = rand(8, 22) + (lcg_value() * 2);
    $type = $types[array_rand($types)];
    $name = $vesselNames[array_rand($vesselNames)] . ' ' . rand(10, 99);
    $flag = $flags[array_rand($flags)];
    
    $vessels[] = [
        'id' => 'MMSI' . rand(100000000, 999999999),
        'name' => $name,
        'type' => $type,
        'flag' => $flag,
        'lat' => round($lat, 4),
        'lng' => round($lng, 4),
        'heading' => round($heading, 1),
        'speedKnots' => round($speed, 1),
        'destination' => $dests[array_rand($dests)]
    ];
}

echo json_encode(['items' => $vessels]);

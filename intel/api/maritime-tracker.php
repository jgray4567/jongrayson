<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: max-age=60');

// Generates simulated real-time AIS vessel data in the Strait of Hormuz
$vessels = [];

$vesselNames = ['MSC GÜLSÜN', 'HMM ALGECIRAS', 'CMA CGM ANTOINE DE SAINT EXUPERY', 'MAERSK MC-KINNEY MOLLER', 'EVER GIVEN', 'OOCL HONG KONG', 'COSCO SHIPPING UNIVERSE', 'ONE TRUST', 'FRONT ALTAIR', 'KOKUKA COURAGEOUS', 'STENA IMPERO', 'MT RIAH', 'BW LILAC', 'GASLOG WARSAW', 'AL MAFRAQ', 'UMM AL AMAD'];
$types = ['Cargo', 'Cargo', 'Cargo', 'Cargo', 'Tanker', 'Tanker', 'Tanker', 'Tanker', 'Tanker', 'LNG Carrier', 'LNG Carrier'];
$flags = ['Panama', 'Liberia', 'Marshall Islands', 'Hong Kong', 'Singapore', 'Malta', 'Bahamas', 'Saudi Arabia', 'Iran', 'UAE'];

// Strait of Hormuz bounding box roughly: Lat 25.5 to 27.5, Lng 54.5 to 57.5
$baseLat = 26.5;
$baseLng = 56.2;

$count = rand(45, 65);
for ($i = 0; $i < $count; $i++) {
    $lat = $baseLat + (lcg_value() - 0.5) * 1.8;
    $lng = $baseLng + (lcg_value() - 0.5) * 2.5;
    $heading = rand(0, 359);
    $speed = rand(8, 22) + (lcg_value() * 2); // knots
    $type = $types[array_rand($types)];
    $name = $vesselNames[array_rand($vesselNames)] . ' ' . rand(10, 99);
    $flag = $flags[array_rand($flags)];
    
    // Add some ships moving strictly along the main shipping lanes
    if ($i < 15) {
        // Traffic separation scheme inbound/outbound
        $lng = 55.0 + ($i * 0.15);
        $lat = 26.0 + ($i * 0.05);
        $heading = rand(60, 80); // Inbound to Gulf
    }
    
    $vessels[] = [
        'id' => 'MMSI' . rand(100000000, 999999999),
        'name' => $name,
        'type' => $type,
        'flag' => $flag,
        'lat' => round($lat, 4),
        'lng' => round($lng, 4),
        'heading' => $heading,
        'speedKnots' => round($speed, 1),
        'destination' => (rand(0, 1) == 1) ? 'Fujairah' : 'Jebel Ali'
    ];
}

echo json_encode(['items' => $vessels]);

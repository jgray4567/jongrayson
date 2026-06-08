<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: max-age=60');

$vessels = [];
$region = isset($_GET['region']) ? $_GET['region'] : 'hormuz';

$vesselNames = ['MSC GÜLSÜN', 'HMM ALGECIRAS', 'CMA CGM ANTOINE DE SAINT EXUPERY', 'MAERSK MC-KINNEY MOLLER', 'EVER GIVEN', 'OOCL HONG KONG', 'COSCO SHIPPING UNIVERSE', 'ONE TRUST', 'FRONT ALTAIR', 'KOKUKA COURAGEOUS', 'STENA IMPERO', 'MT RIAH', 'BW LILAC', 'GASLOG WARSAW', 'AL MAFRAQ', 'UMM AL AMAD'];
$types = ['Cargo', 'Cargo', 'Cargo', 'Cargo', 'Tanker', 'Tanker', 'Tanker', 'Tanker', 'Tanker', 'LNG Carrier', 'LNG Carrier'];

if ($region === 'mexico') {
    $baseLat = 24.5;
    $baseLng = -90.0;
    $dests = ['Houston', 'New Orleans', 'Galveston', 'Veracruz', 'Mobile', 'Corpus Christi'];
    $flags = ['USA', 'Panama', 'Liberia', 'Marshall Islands', 'Bahamas', 'Mexico'];
    $count = rand(35, 55);
} else {
    $baseLat = 26.5;
    $baseLng = 56.2;
    $dests = ['Fujairah', 'Jebel Ali', 'Bandar Abbas', 'Doha', 'Muscat'];
    $flags = ['Panama', 'Liberia', 'Marshall Islands', 'Hong Kong', 'Singapore', 'Malta', 'Bahamas', 'Saudi Arabia', 'Iran', 'UAE'];
    $count = rand(45, 65);
}

for ($i = 0; $i < $count; $i++) {
    $lat = $baseLat + (lcg_value() - 0.5) * 4.0;
    $lng = $baseLng + (lcg_value() - 0.5) * 5.0;
    $heading = rand(0, 359);
    $speed = rand(8, 22) + (lcg_value() * 2);
    $type = $types[array_rand($types)];
    $name = $vesselNames[array_rand($vesselNames)] . ' ' . rand(10, 99);
    $flag = $flags[array_rand($flags)];
    
    if ($i < 15) {
        // Pseudo shipping lanes
        if ($region === 'hormuz') {
            $lng = 55.0 + ($i * 0.15);
            $lat = 26.0 + ($i * 0.05);
            $heading = rand(60, 80);
        } else {
            $lng = -92.0 + ($i * 0.2);
            $lat = 26.0 + ($i * 0.1);
            $heading = rand(330, 350);
        }
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
        'destination' => $dests[array_rand($dests)]
    ];
}

echo json_encode(['items' => $vessels]);

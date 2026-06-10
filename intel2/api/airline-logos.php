<?php
header('Content-Type: application/json');
header('Cache-Control: public, max-age=86400');

// Maps airline names (from FlightAware) and ICAO codes to IATA codes
// for the pics.avs.io logo service (https://pics.avs.io/{w}/{h}/{IATA}.png)

$icaoToIata = [
  // US Major
  'AAL'=>'AA','UAL'=>'UA','DAL'=>'DL','SWA'=>'WN','JBU'=>'B6','AAY'=>'G4','ALK'=>'AS','SKW'=>'OO',
  'ENY'=>'MQ','JIA'=>'EV','RPA'=>'YX','FFT'=>'F9','NKS'=>'NK','SPI'=>'SY','ALG'=>'KG',
  // US Cargo/Regional
  'FDX'=>'FX','UPS'=>'5X','ATN'=>'T8','PAA'=>'MI','BOE'=>'BA',
  // Canada
  'ACA'=>'AC','WJA'=>'WS','JZA'=>'9M','CFC'=>'7F','KFA'=>'K2',
  // Europe
  'BAW'=>'BA','DLH'=>'LH','AFR'=>'AF','KLM'=>'KL','AZA'=>'AZ','IBE'=>'IB','SAS'=>'SK',
  'BCS'=>'U2','EZY'=>'U2','RYR'=>'FR','VLG'=>'VY','TAP'=>'TP','FIN'=>'AY','LOT'=>'LO',
  'AUA'=>'OS','SWR'=>'LX','THA'=>'TG','MSR'=>'MS','RAM'=>'AT','TCS'=>'3V','ETH'=>'ET',
  'BEL'=>'SN','CFE'=>'BE','EIN'=>'EI','CLH'=>'LH','BCY'=>'BC','AEE'=>'A3','OA'=>'OA',
  'ROU'=>'V7','TAR'=>'TA','ADW'=>'6A','PGT'=>'PC','SXS'=>'DI',
  // UK/Ireland
  'EZY'=>'U2','RYR'=>'FR','TOM'=>'BY','EXS'=>'LS','MON'=>'ZB','BMI'=>'BD','BEE'=>'BA',
  // Asia
  'CPA'=>'CX','ANA'=>'NH','JAL'=>'JL','KAL'=>'KE','CSN'=>'CZ','CCA'=>'CA','CSH'=>'MU',
  'AMU'=>'MF','CQH'=>'9C','CDG'=>'CZ','JSA'=>'9W','AIC'=>'AI','IGA'=>'6E','THA'=>'TG',
  'MAS'=>'MH','SIA'=>'SQ','GIA'=>'GA','PAL'=>'PR','VNL'=>'VN','APJ'=>'3K','SBI'=>'S7',
  // Middle East
  'UAE'=>'EK','ETD'=>'EY','QTR'=>'QR','SVA'=>'SV','RJA'=>'RJ','MEA'=>'ME','KAC'=>'KU',
  'OMA'=>'WY','IRA'=>'IA',
  // Latin America
  'LAN'=>'LA','TAM'=>'JJ','AVA'=>'AV','AMX'=>'AM','COPA'=>'CM','AAL'=>'AA',
  'IBE'=>'IB','ONE'=>'1O','ACA'=>'AC',
  // Oceania
  'QFA'=>'QF','ANZ'=>'NZ','VAU'=>'VA','TNT'=>'TT','JST'=>'JQ',
  // Africa
  'SAA'=>'SA','ETH'=>'ET','KQ'=>'KQ','RAM'=>'AT','MSR'=>'MS','DTA'=>'DT',
  // Charter/LCC
  'RYR'=>'FR','EZY'=>'U2','WZZ'=>'W6','SXS'=>'DI','TUI'=>'BY','ENT'=>'E5',
  'CFG'=>'DE','NRN'=>'N4','VOE'=>'V5','SCX'=>'SQ',
];

$nameToIata = [
  'AMERICAN AIRLINES' => 'AA',
  'UNITED AIRLINES' => 'UA',
  'DELTA AIR LINES' => 'DL',
  'SOUTHWEST AIRLINES' => 'WN',
  'JETBLUE AIRWAYS' => 'B6',
  'ALASKA AIRLINES' => 'AS',
  'FRONTIER AIRLINES' => 'F9',
  'SPIRIT AIRLINES' => 'NK',
  'HAWAIIAN AIRLINES' => 'HA',
  'AIR CANADA' => 'AC',
  'WESTJET' => 'WS',
  'BRITISH AIRWAYS' => 'BA',
  'LUFTHANSA' => 'LH',
  'AIR FRANCE' => 'AF',
  'KLM' => 'KL',
  'EMIRATES' => 'EK',
  'QATAR AIRWAYS' => 'QR',
  'SINGAPORE AIRLINES' => 'SQ',
  'QANTAS' => 'QF',
  'FEDERAL EXPRESS' => 'FX',
  'UNITED PARCEL SERVICE' => '5X',
  'AMAZON PRIME AIR' => 'MZ',
  'ATLAS AIR' => '5Y',
  'POLAR AIR CARGO' => 'PO',
  'CARGOLUX' => 'CV',
];

$airlineName = trim((string) ($_GET['airline'] ?? ''));
$width = (int) ($_GET['w'] ?? 80);
$height = (int) ($_GET['h'] ?? 32);

// Extract ICAO from callsign prefix (first 3 chars, common pattern)
$callsign = strtoupper(trim((string) ($_GET['callsign'] ?? '')));
$icaoPrefix = substr($callsign, 0, 3);

// Try name match first, then ICAO prefix
$iata = null;
$upperName = strtoupper($airlineName);

foreach ($nameToIata as $name => $code) {
  if (strpos($upperName, $name) !== false) {
    $iata = $code;
    break;
  }
}

if (!$iata && isset($icaoToIata[$icaoPrefix])) {
  $iata = $icaoToIata[$icaoPrefix];
}

// Local SVG fallbacks for airlines not in pics.avs.io
$localLogos = ['5X','FX','MZ','5Y','PO','CV','GF','D0','LC'];

// If we have an IATA code and it's not a local logo, proxy it as a base64 image
// to bypass strict adblockers (like Pi-hole/Brave/UBlock) that block the pics.avs.io domain
$proxiedUrl = null;
if ($iata) {
    if (in_array($iata, $localLogos)) {
        $proxiedUrl = "airline-logos/{$iata}.svg";
    } else {
        // Proxy the external image
        $externalUrl = "https://pics.avs.io/{$width}/{$height}/{$iata}.png";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $externalUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        
        // Add fake user agent just in case
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        $imageData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (PHP_VERSION_ID < 80000) {
            curl_close($ch);
        }
        
        if ($httpCode === 200 && $imageData) {
            $base64 = base64_encode($imageData);
            $proxiedUrl = "data:image/png;base64,{$base64}";
        }
    }
}

$result = [
  'iata' => $iata,
  'icaoPrefix' => $icaoPrefix,
  'logoUrl' => $proxiedUrl,
  'airline' => $airlineName ?: null,
];

echo json_encode($result, JSON_UNESCAPED_SLASHES);

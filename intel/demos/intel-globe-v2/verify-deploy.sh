#!/usr/bin/env bash
# Post-deploy verification for the Intel Layer globe.
#
# Compares what the live server returns against the files sitting next to this
# script, so it cannot go stale. An earlier version hardcoded expected byte
# counts and started reporting false SIZE MISMATCH failures the moment the
# files changed — a verification tool that cries wolf is worse than none.
#
#   bash intel/demos/intel-globe-v2/verify-deploy.sh

set -u
BASE="https://www.jongrayson.com/intel/demos/intel-globe-v2"
API="https://www.jongrayson.com/intel/api"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Files that must be byte-identical live. Dev-only files are excluded: they
# get mirrored by the deploy but are not part of the page.
ASSETS=(
  index.html
  intel-core.js aircraft-layer.js orbital-layer.js
  mission-ui.js mission-ui.css
  fires-layer.js ships-layer.js timeline-engine.js
  extended-layers.css
)

fail=0
printf "%-22s %5s %10s %10s  %s\n" "FILE" "HTTP" "LIVE" "LOCAL" "RESULT"
for f in "${ASSETS[@]}"; do
  [ -f "$HERE/$f" ] || { printf "%-22s %5s %10s %10s  %s\n" "$f" "-" "-" "-" "no local copy"; continue; }
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$f")
  live=$(curl -s "$BASE/$f" | wc -c | tr -d ' ')
  local_n=$(wc -c < "$HERE/$f" | tr -d ' ')

  if [ "$code" != "200" ]; then res="HTTP $code"; fail=1
  elif [ "$live" != "$local_n" ]; then res="MISMATCH — not deployed?"; fail=1
  else res="ok"; fi
  printf "%-22s %5s %10s %10s  %s\n" "$f" "$code" "$live" "$local_n" "$res"
done

echo
echo "--- data endpoints ---"
check_api () {
  local label="$1" url="$2"
  local code bytes res
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  bytes=$(curl -s "$url" | wc -c | tr -d ' ')
  res="ok"
  [ "$code" != "200" ] && { res="HTTP $code"; fail=1; }
  # A 200 carrying almost nothing means the feed answered but returned no data.
  [ "$code" = "200" ] && [ "$bytes" -lt 200 ] && { res="EMPTY RESPONSE"; fail=1; }
  printf "  %-26s %5s %10s bytes  %s\n" "$label" "$code" "$bytes" "$res"
}
check_api "air traffic"   "$BASE/air-traffic.php?regions=north-america"
check_api "satellites"    "$API/satellite-tracker.php"
check_api "earthquakes"   "$API/live-feeds.php?source=earthquakes"
check_api "weather"       "$API/live-feeds.php?source=weather"
check_api "fires"         "$API/extended-feeds.php?source=fires"
check_api "airline logos" "$API/airline-logos.php?callsign=SWA1234&w=240&h=88"

echo
echo "--- airline logo mapping spot-check ---"
# These six previously resolved to the WRONG carrier or to nothing at all.
for pair in ASA:AS SCX:SY CMP:CM VOI:Y4 UAL:UA FDX:FX; do
  icao="${pair%%:*}"; want="${pair##*:}"
  got=$(curl -s "$API/airline-logos.php?callsign=${icao}1234" \
        | python3 -c 'import sys,json;print(json.load(sys.stdin).get("iata") or "-")' 2>/dev/null)
  if [ "$got" = "$want" ]; then printf "  %-5s -> %-4s ok\n" "$icao" "$got"
  else printf "  %-5s -> %-4s EXPECTED %s\n" "$icao" "$got" "$want"; fail=1; fi
done

echo
if [ "$fail" = "0" ]; then echo "PASS — live matches local, all feeds responding."
else echo "FAIL — see rows above."; fi
exit $fail

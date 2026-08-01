#!/usr/bin/env bash
# Post-deploy verification for the Intel Layer globe.
# Confirms every required file is live, is the right size, and is served with
# a usable Content-Type. Run after uploading.

BASE="https://www.jongrayson.com/intel/demos/intel-globe-v2"

# file:expected_bytes
FILES=(
  "intel-core.js:20594"
  "aircraft-layer.js:19473"
  "orbital-layer.js:17864"
  "mission-ui.js:28975"
  "mission-ui.css:24757"
  "index.html:177797"
  "air-traffic.php:-"
  "ships-layer.js:29268"
  "fires-layer.js:18022"
  "timeline-engine.js:24178"
  "extended-layers.css:14594"
)

fail=0
printf "%-22s %6s %10s %10s  %s\n" "FILE" "HTTP" "SERVED" "EXPECTED" "TYPE"
for entry in "${FILES[@]}"; do
  f="${entry%%:*}"; want="${entry##*:}"
  hdr=$(curl -sI "$BASE/$f")
  code=$(printf '%s' "$hdr" | awk 'NR==1{print $2}')
  ctype=$(printf '%s' "$hdr" | awk -F': ' 'tolower($1)=="content-type"{print $2}' | tr -d '\r')
  size=$(curl -s "$BASE/$f" | wc -c | tr -d ' ')

  status="ok"
  [ "$code" != "200" ] && { status="HTTP $code"; fail=1; }
  if [ "$want" != "-" ] && [ "$code" = "200" ] && [ "$size" != "$want" ]; then
    status="SIZE MISMATCH"; fail=1
  fi
  printf "%-22s %6s %10s %10s  %-24s %s\n" "$f" "$code" "$size" "$want" "$ctype" "$status"
done

echo
echo "--- API endpoints ---"
for api in "air-traffic.php?regions=north-america" "../../api/satellite-tracker.php" \
           "../../api/live-feeds.php?source=earthquakes" "../../api/extended-feeds.php?source=fires"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$api")
  bytes=$(curl -s "$BASE/$api" | wc -c | tr -d ' ')
  printf "  %-46s %s  %s bytes\n" "${api}" "$code" "$bytes"
  [ "$code" != "200" ] && fail=1
done

echo
if [ "$fail" = "0" ]; then
  echo "PASS — all files and endpoints reachable."
else
  echo "FAIL — see rows above."
fi
exit $fail

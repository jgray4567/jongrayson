#!/usr/bin/env python3
"""
Pittsburgh Crime Danger Zone Predictor
Analyzes historical crime data to predict risk zones by day-of-week, hour, and category.
Outputs a JSON file consumed by the Intel crime map for predictive overlays.
"""
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime

INPUT = sys.argv[1] if len(sys.argv) > 1 else 'data/pittsburgh/daily_crimes.json'
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else 'data/pittsburgh/predicted_danger_zones.json'

# Grid cell size in degrees (~500m x ~370m at Pittsburgh latitude)
GRID_SIZE = 0.0045

def load_data(path):
    with open(path) as f:
        return json.load(f)

def grid_key(lat, lng):
    """Quantize lat/lng to grid cell"""
    return (round(lat / GRID_SIZE) * GRID_SIZE, round(lng / GRID_SIZE) * GRID_SIZE)

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def analyze(data):
    now = datetime.now()
    current_dow = now.strftime('%A')   # e.g. "Friday"
    current_hour = now.hour
    
    # --- Build grid-based stats ---
    # grid -> { dow -> { hour -> { category -> count } } }
    grid_dow_hour_cat = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))
    grid_total = Counter()
    grid_violent = Counter()
    
    for d in data:
        try:
            t = datetime.strptime(d['time'], '%Y-%m-%d %H:%M')
        except:
            continue
        lat, lng = d.get('lat'), d.get('lng')
        if not lat or not lng:
            continue
        gk = grid_key(lat, lng)
        dow = t.strftime('%A')
        hour = t.hour
        cat = d.get('category', 'Other')
        grid_dow_hour_cat[gk][dow][hour][cat] += 1
        grid_total[gk] += 1
        if cat == 'Violent':
            grid_violent[gk] += 1
    
    # --- Compute predictions for current day + hour window ---
    # Consider crimes within ±2 hours of current time and current day of week
    hour_window = range(max(0, current_hour - 2), min(24, current_hour + 3))
    
    predictions = []
    total_all = sum(grid_total.values())
    
    for gk, dow_data in grid_dow_hour_cat.items():
        # Count for current day of week within hour window
        dow_counts = dow_data.get(current_dow, {})
        window_count = sum(sum(hour_counts.values()) for h, hour_counts in dow_counts.items() if h in hour_window)
        window_violent = sum(hour_counts.get('Violent', 0) for h, hour_counts in dow_counts.items() if h in hour_window)
        
        # Full day of week total
        dow_total = sum(sum(hour_counts.values()) for hour_counts in dow_counts.values())
        dow_violent = sum(hour_counts.get('Violent', 0) for hour_counts in dow_counts.values())
        
        # Total all-time for this cell
        all_time = grid_total[gk]
        all_time_violent = grid_violent.get(gk, 0)
        
        if window_count == 0:
            continue
        
        # --- Scoring ---
        # Base: how does this cell's current DOW+hour compare to the overall average?
        # Normalize per-day: avg incidents per cell per day = all_time / num_days
        # We have ~10 months ≈ 43 weeks ≈ 43 instances of each DOW
        
        # Expected incidents per DOW for this cell
        expected_dow = all_time / 7.0
        
        # Observed vs expected for this DOW
        dow_ratio = dow_total / max(expected_dow, 0.01)
        
        # Time-of-day multiplier: what fraction of this cell's DOW crimes happen in this hour window?
        # Typically 5/24 ≈ 0.21; higher means this time is disproportionately active
        time_fraction = window_count / max(dow_total, 1)
        expected_time_fraction = len(hour_window) / 24.0
        time_ratio = time_fraction / max(expected_time_fraction, 0.01)
        
        # Violence multiplier: higher violent ratio = more dangerous
        violent_ratio = (window_violent / max(window_count, 1)) / max(all_time_violent / max(all_time, 1), 0.01)
        
        # Composite danger score (0-100 scale)
        # Weight: time relevance (25%), day pattern (20%), violence factor (15%), recency (25%), frequency (15%)
        recency_boost = 1.0
        if current_dow in ['Friday', 'Saturday']:
            recency_boost = 1.15  # Weekend nights historically riskier
        
        danger_score = min(100, max(0, (
            time_ratio * 20 +
            dow_ratio * 15 +
            violent_ratio * 10 +
            min(window_count * 1.5, 20) +  # raw frequency
            min(dow_total / max(1, total_all / len(grid_total)), 25) * recency_boost  # relative concentration
        )))
        
        # Round to 2 decimal places
        danger_score = round(danger_score, 2)
        
        # Determine threat level
        if danger_score >= 65:
            threat_level = 'high'
        elif danger_score >= 35:
            threat_level = 'medium'
        elif danger_score >= 15:
            threat_level = 'low'
        else:
            continue  # Skip negligible predictions
        
        # Find peak hour for this cell on this DOW
        peak_hour = max(dow_counts.keys(), key=lambda h: sum(dow_counts[h].values())) if dow_counts else current_hour
        
        # Top incident types for this cell on this DOW
        all_types = Counter()
        for hour_counts in dow_counts.values():
            for cat, cnt in hour_counts.items():
                all_types[cat] += cnt
        
        predictions.append({
            'lat': round(gk[0], 6),
            'lng': round(gk[1], 6),
            'dangerScore': danger_score,
            'threatLevel': threat_level,
            'incidentsNow': window_count,
            'violentNow': window_violent,
            'incidentsToday': dow_total,
            'peakHour': peak_hour,
            'topCategory': all_types.most_common(1)[0][0] if all_types else 'Other',
            'dow': current_dow,
            'hourWindow': f"{current_hour-2}:00–{current_hour+2}:00",
        })
    
    # Sort by danger score descending
    predictions.sort(key=lambda p: p['dangerScore'], reverse=True)
    
    # Also compute zone-level summaries
    zone_stats = defaultdict(lambda: {'total': 0, 'violent': 0, 'cells': 0, 'maxScore': 0})
    for p in predictions:
        z = None
        # Find zone by proximity to zone centers (we'll assign later in JS)
        zone_stats['_all']['total'] += p['incidentsNow']
        zone_stats['_all']['violent'] += p['violentNow']
        zone_stats['_all']['cells'] += 1
        zone_stats['_all']['maxScore'] = max(zone_stats['_all']['maxScore'], p['dangerScore'])
    
    return {
        'generatedAt': datetime.now().isoformat(),
        'currentDow': current_dow,
        'currentHour': current_hour,
        'hourWindow': f"{max(0,current_hour-2)}:00–{min(24,current_hour+3)}:00",
        'totalCells': len(predictions),
        'highRiskCells': sum(1 for p in predictions if p['threatLevel'] == 'high'),
        'mediumRiskCells': sum(1 for p in predictions if p['threatLevel'] == 'medium'),
        'lowRiskCells': sum(1 for p in predictions if p['threatLevel'] == 'low'),
        'predictions': predictions[:500],  # Cap at 500 for performance
    }

if __name__ == '__main__':
    data = load_data(INPUT)
    result = analyze(data)
    with open(OUTPUT, 'w') as f:
        json.dump(result, f, separators=(',', ':'))
    print(f"Generated {result['totalCells']} danger zone predictions")
    print(f"  High: {result['highRiskCells']}, Medium: {result['mediumRiskCells']}, Low: {result['lowRiskCells']}")
    print(f"  Saved to {OUTPUT}")
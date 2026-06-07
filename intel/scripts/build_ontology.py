import urllib.request
import json
import os
import xml.etree.ElementTree as ET

# Live Intelligence Feeds (CISA Cyber Alerts & Global News)
FEEDS = [
    "https://www.cisa.gov/uscert/ncas/alerts.xml",
    "https://feeds.bbci.co.uk/news/world/rss.xml"
]

def fetch_signals():
    signals = []
    for url in FEEDS:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read()
                root = ET.fromstring(xml_data)
                for item in root.findall('.//item')[:5]:
                    title = item.find('title')
                    if title is not None and title.text:
                        signals.append(title.text)
        except Exception as e:
            print(f"Error fetching {url}: {e}")
    return signals

def extract_ontology(signals):
    # Point to Jerry's local API on the Mac Studio
    # If Jerry is off/unavailable, it falls back to a simulated baseline to keep the site up.
    JERRY_API_URL = "http://192.168.1.100:1234/v1/chat/completions"
    
    prompt = (
        "You are the automated Intelligence Extraction Engine for jongrayson.com (powered by JerryKnows.ai). Your job is to convert the following live global threat signals into a Palantir-style node graph ontology.\n"
        "Return ONLY valid JSON. Format:\n"
        "{\"nodes\": [{\"id\": \"id_string\", \"group\": 0-4, \"label\": \"Display Name\", \"size\": 10}], \"links\": [{\"source\": \"id1\", \"target\": \"id2\", \"value\": 1}]}\n"
        "Groups: 0=Nexus, 1=Org/Asset, 2=Threat/Event, 3=Location, 4=Misc.\n"
        "Include an 'intel_nexus' node (group 0) with the label 'JerryKnows.ai - Global Nexus' and link the most important extracted events, organizations, and locations to it.\n\n"
        "Signals:\n" + "\n".join(signals)
    )
    
    payload = {
        "model": "deepseek-v4-flash", # Your fast local model
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }
    
    try:
        req = urllib.request.Request(JERRY_API_URL, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=45) as response:
            result = json.loads(response.read().decode('utf-8'))
            content = result['choices'][0]['message']['content']
            return json.loads(content)
    except Exception as e:
        print(f"Jerry API unavailable or failed: {e}")
        print("Falling back to simulated tactical data...")
        # Fallback payload representing typical outputs
        return {
            "nodes": [
                {"id": "intel_nexus", "group": 0, "label": "J-01 (NEXUS)", "size": 20},
                {"id": "cisa_alert", "group": 4, "label": "CISA Alert", "size": 12},
                {"id": "threat_cyber", "group": 2, "label": "Cyber Campaign", "size": 16},
                {"id": "loc_dc", "group": 3, "label": "Washington D.C.", "size": 14},
                {"id": "intel_feed", "group": 1, "label": "Global News Feed", "size": 12}
            ],
            "links": [
                {"source": "intel_nexus", "target": "cisa_alert", "value": 2},
                {"source": "cisa_alert", "target": "threat_cyber", "value": 3},
                {"source": "threat_cyber", "target": "loc_dc", "value": 4},
                {"source": "intel_nexus", "target": "intel_feed", "value": 1}
            ]
        }

if __name__ == "__main__":
    print("1. Fetching live signals...")
    signals = fetch_signals()
    print(f"   -> Found {len(signals)} signals.")
    
    print("2. Pinging Jerry (Local AI) for Ontology Extraction...")
    ontology = extract_ontology(signals)
    
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "ontology.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    with open(out_path, 'w') as f:
        json.dump(ontology, f, indent=2)
        
    print(f"3. Ontology generated and saved to {out_path}")

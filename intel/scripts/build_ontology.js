const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Live Intelligence Feeds
const FEEDS = [
    "https://www.cisa.gov/uscert/ncas/alerts.xml",
    "https://feeds.bbci.co.uk/news/world/rss.xml"
];

async function fetchSignals() {
    const signals = [];
    for (const url of FEEDS) {
        try {
            console.log(`Fetching ${url}...`);
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const xml = await response.text();
            
            // Very rudimentary regex extraction for <title> since Node doesn't have built-in XML DOM
            const titleMatches = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/gi) || [];
            
            // Skip the first title (usually the channel title) and grab the next 5 items
            for (let i = 1; i < Math.min(titleMatches.length, 6); i++) {
                let text = titleMatches[i].replace(/<\/?title[^>]*>/gi, '').trim();
                text = text.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'); // Remove CDATA
                if (text && !text.includes('BBC News - World') && !text.includes('National Cyber Awareness System')) {
                    signals.push(text);
                }
            }
        } catch (e) {
            console.error(`Error fetching ${url}:`, e);
        }
    }
    return signals;
}

async function extractOntology(signals) {
    const prompt = `You are the automated Intelligence Extraction Engine for jongrayson.com (powered by JerryKnows.ai). Your job is to convert the following live global threat signals into a Palantir-style node graph ontology.
Return ONLY valid JSON. Format:
{"nodes": [{"id": "id_string", "group": 0-4, "label": "Display Name", "size": 10}], "links": [{"source": "id1", "target": "id2", "value": 1}]}
Groups: 0=Nexus, 1=Org/Asset, 2=Threat/Event, 3=Location, 4=Misc.
Include an 'intel_nexus' node (group 0) with the label 'JerryKnows.ai - Global Nexus' and link the most important extracted events, organizations, and locations to it.
Always ensure the JSON is perfectly valid and contains no markdown formatting.

Signals:
${signals.join("\n")}`;

    console.log("Pinging OpenClaw Infer...");
    
    // Write prompt to temp file to avoid shell escaping issues
    const promptPath = path.join('/tmp', 'ontology_prompt.txt');
    fs.writeFileSync(promptPath, prompt);
    
    try {
        const output = execSync(`openclaw infer model run --model "ollama/glm-5.1:cloud" --prompt "$(cat ${promptPath})" --json`, { encoding: 'utf-8' });
        
        let jsonStr = output.trim();
        // Strip markdown fences if present
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.substring(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.substring(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.substring(0, jsonStr.length - 3);
        
        const data = JSON.parse(jsonStr.trim());
        return data;
    } catch (e) {
        console.error("OpenClaw Infer failed or returned invalid JSON:", e.message);
        console.log("Falling back to simulated tactical data...");
        return {
            "nodes": [
                {"id": "intel_nexus", "group": 0, "label": "JerryKnows.ai - Global Nexus", "size": 20},
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
        };
    } finally {
        if (fs.existsSync(promptPath)) fs.unlinkSync(promptPath);
    }
}

async function run() {
    console.log("1. Fetching live signals...");
    const signals = await fetchSignals();
    console.log(`   -> Found ${signals.length} signals.`);
    
    console.log("2. Extracting Ontology...");
    const ontology = await extractOntology(signals);
    
    const outPath = path.join(__dirname, '..', 'data', 'ontology.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    
    fs.writeFileSync(outPath, JSON.stringify(ontology, null, 2));
    console.log(`3. Ontology generated and saved to ${outPath}`);
}

run();

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Live Intelligence Feeds
const FEEDS = [
    "https://www.cisa.gov/uscert/ncas/alerts.xml",
    "https://feeds.bbci.co.uk/news/world/rss.xml"
];

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function fetchSignals() {
    const signals = [];
    for (const url of FEEDS) {
        try {
            console.log(`Fetching ${url}...`);
            const xml = await fetchUrl(url);
            const titleMatches = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/gi) || [];
            
            for (let i = 1; i < Math.min(titleMatches.length, 6); i++) {
                let text = titleMatches[i].replace(/<\/?title[^>]*>/gi, '').trim();
                text = text.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'); 
                if (text && !text.includes('BBC News - World') && !text.includes('National Cyber Awareness System')) {
                    signals.push(text);
                }
            }
        } catch (e) {
            console.error(`Error fetching ${url}:`, e.message);
        }
    }
    return signals;
}


async function extractOntology(signals) {
function callOpenClawApi(prompt) {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        const os = require('os');
        let token = '';
        try {
            const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            token = configData.gateway.auth.token;
        } catch (e) {
            token = process.env.OPENCLAW_GATEWAY_TOKEN || '';
        }

        const reqOpts = {
            hostname: '127.0.0.1',
            port: 18789,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`API Error: ${res.statusCode} ${data}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.choices[0].message.content);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);

        req.write(JSON.stringify({
            model: "openclaw",
            messages: [
                { role: "system", content: "OVERRIDE_MODEL: ollama/glm-5.1:cloud" },
                { role: "user", content: prompt }
            ]
        }));
        req.end();
    });
}
    const prompt = `You are the automated Intelligence Extraction Engine for jongrayson.com (powered by JerryKnows.ai). Your job is to convert the following live global threat signals into a Palantir-style node graph ontology.
Return ONLY valid JSON. Format:
{"nodes": [{"id": "id_string", "group": 0-4, "label": "Display Name", "size": 10}], "links": [{"source": "id1", "target": "id2", "value": 1}]}
Groups: 0=Nexus, 1=Org/Asset, 2=Threat/Event, 3=Location, 4=Misc.
Include an 'intel_nexus' node (group 0) with the label 'JerryKnows.ai - Global Nexus' and link the most important extracted events, organizations, and locations to it.
Always ensure the JSON is perfectly valid and contains no markdown formatting.

Signals:
${signals.join("\n")}`;

    console.log("Pinging OpenClaw Local API...");
    
    try {
        let jsonStr = await callOpenClawApi(prompt);
        jsonStr = jsonStr.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.substring(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.substring(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.substring(0, jsonStr.length - 3);
        
        return JSON.parse(jsonStr.trim());
    } catch (e) {
        console.error("OpenClaw API failed:", e.message);
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

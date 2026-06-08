const fs = require('fs');
const path = require('path');
const https = require('https');

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
            
            // Extract individual items
            const items = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/gi) || [];
            
            for (let i = 0; i < Math.min(items.length, 15); i++) {
                const itemXml = items[i];
                
                // Get title
                let titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                if (!titleMatch) continue;
                let text = titleMatch[1].trim();
                text = text.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
                
                // Get link
                let linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || itemXml.match(/<link[^>]*href="([^"]+)"/i);
                let linkUrl = '';
                if (linkMatch) {
                    linkUrl = (linkMatch[1] || '').trim();
                    linkUrl = linkUrl.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
                }
                
                // Get image/thumbnail
                let imgMatch = itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i) || itemXml.match(/<enclosure[^>]*url="([^"]+)"/i);
                let imgUrl = imgMatch ? imgMatch[1] : '';
                
                if (text && !text.includes('BBC News - World') && !text.includes('National Cyber Awareness System')) {
                    signals.push({
                        title: text,
                        url: linkUrl,
                        image: imgUrl
                    });
                }
            }
        } catch (e) {
            console.error(`Error fetching ${url}:`, e.message);
        }
    }
    return signals;
}

// Procedurally generate a rich interconnected ontology from headlines
function buildProceduralOntology(signals) {
    const nodes = [];
    const links = [];
    
    nodes.push({ id: "intel_nexus", group: 0, label: "JerryKnows.ai - Global Nexus", size: 24 });
    
    // Core regions to act as hubs
    const regions = [
        { id: "reg_na", label: "North America", group: 3 },
        { id: "reg_eu", label: "Europe", group: 3 },
        { id: "reg_me", label: "Middle East", group: 3 },
        { id: "reg_asia", label: "Asia-Pacific", group: 3 },
        { id: "reg_sa", label: "South America", group: 3 },
        { id: "reg_afr", label: "Africa", group: 3 }
    ];
    
    // Thematic hubs
    const themes = [
        { id: "theme_geo", label: "Geopolitical Tension", group: 4 },
        { id: "theme_cyber", label: "Cyber Security", group: 4 },
        { id: "theme_econ", label: "Global Economy", group: 4 },
        { id: "theme_sport", label: "International Sports", group: 4 }
    ];
    
    regions.forEach(r => nodes.push({ id: r.id, group: r.group, label: r.label, size: 16 }));
    themes.forEach(t => nodes.push({ id: t.id, group: t.group, label: t.label, size: 14 }));
    
    // Link core to nexus
    regions.forEach(r => links.push({ source: r.id, target: "intel_nexus", value: 2 }));
    themes.forEach(t => links.push({ source: t.id, target: "intel_nexus", value: 1 }));
    
    // Cross-link some regions and themes
    links.push({ source: "theme_geo", target: "reg_me", value: 3 });
    links.push({ source: "theme_geo", target: "reg_eu", value: 3 });
    links.push({ source: "theme_geo", target: "reg_asia", value: 2 });
    links.push({ source: "theme_cyber", target: "reg_na", value: 3 });
    links.push({ source: "theme_econ", target: "reg_na", value: 2 });
    links.push({ source: "theme_econ", target: "reg_eu", value: 2 });
    links.push({ source: "theme_sport", target: "reg_me", value: 1 });
    links.push({ source: "theme_sport", target: "reg_sa", value: 1 });

    // Process headlines
    signals.forEach((sigObj, idx) => {
        const sig = sigObj.title;
        const id = `sig_${idx}`;
        const isCyber = sig.toLowerCase().includes('cyber') || sig.toLowerCase().includes('hack') || sig.toLowerCase().includes('vulnerability');
        
        nodes.push({ 
            id, 
            group: isCyber ? 1 : 2, 
            label: sig, 
            size: 12,
            url: sigObj.url,
            image: sigObj.image
        });
        
        // Naive routing based on keywords
        let routed = false;
        if (sig.toLowerCase().match(/us|biden|trump|america|mexico/)) { links.push({ source: id, target: "reg_na", value: 1 }); routed=true; }
        if (sig.toLowerCase().match(/europe|uk|france|germany|zelensky|ukraine|russia/)) { links.push({ source: id, target: "reg_eu", value: 1 }); routed=true; }
        if (sig.toLowerCase().match(/israel|gaza|beirut|iran|lebanon/)) { links.push({ source: id, target: "reg_me", value: 1 }); routed=true; }
        if (sig.toLowerCase().match(/china|xi|korea|japan|india/)) { links.push({ source: id, target: "reg_asia", value: 1 }); routed=true; }
        if (sig.toLowerCase().match(/peru|brazil|argentina/)) { links.push({ source: id, target: "reg_sa", value: 1 }); routed=true; }
        if (sig.toLowerCase().match(/africa|boko haram|sudan/)) { links.push({ source: id, target: "reg_afr", value: 1 }); routed=true; }
        
        if (sig.toLowerCase().match(/oil|market|economy|prices|trade/)) { links.push({ source: id, target: "theme_econ", value: 1 }); routed=true; }
        if (sig.toLowerCase().match(/world cup|soccer|football|fans|match/)) { links.push({ source: id, target: "theme_sport", value: 1 }); routed=true; }
        if (isCyber) { links.push({ source: id, target: "theme_cyber", value: 2 }); routed=true; }
        
        if (!routed) {
            links.push({ source: id, target: "theme_geo", value: 1 });
        }
        
        // Add some random cross-links between signals to make the web dense
        if (idx > 0 && Math.random() > 0.6) {
            links.push({ source: id, target: `sig_${idx - 1}`, value: 1 });
        }
    });

    return { nodes, links };
}
async function run() {
    console.log("1. Fetching live signals...");
    const signals = await fetchSignals();
    console.log(`   -> Found ${signals.length} signals.`);
    
    console.log("2. Building Procedural Ontology...");
    const ontology = buildProceduralOntology(signals);
    
    const outPath = path.join(__dirname, '..', 'data', 'ontology.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    
    fs.writeFileSync(outPath, JSON.stringify(ontology, null, 2));
    console.log(`3. Ontology generated and saved to ${outPath}`);
}

run();

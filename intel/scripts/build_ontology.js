const fs = require('fs');
const path = require('path');
const https = require('https');

// Live Intelligence Feeds
const FEEDS = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "https://moxie.foxnews.com/google-publisher/world.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://feeds.skynews.com/feeds/rss/world.xml",
    "https://rss.politico.com/politics-news.xml",
    "https://feeds.washingtonpost.com/rss/world",
    "https://www.theguardian.com/world/rss",
    "https://feeds.nbcnews.com/nbcnews/public/world"
];

// Drop CISA from the main feed — long-lived advisories that make the globe look stale.
// Keep it as a secondary cyber-only feed with its own freshness rules.
const CYBER_FEED = "https://www.cisa.gov/uscert/ncas/alerts.xml";
const MAX_AGE_HOURS = 24; // Only show items published within last 24 hours

async function fetchUrl(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return await res.text();
}

function parsePubDate(itemXml) {
    // Try standard RSS pubDate
    let match = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    if (match) {
        const d = new Date(match[1].trim());
        if (!isNaN(d)) return d;
    }
    // Try Atom published
    match = itemXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
    if (match) {
        const d = new Date(match[1].trim());
        if (!isNaN(d)) return d;
    }
    // Try Atom updated
    match = itemXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    if (match) {
        const d = new Date(match[1].trim());
        if (!isNaN(d)) return d;
    }
    return null;
}

function isFresh(pubDate, maxAgeHours) {
    if (!pubDate) return true; // No date = keep (better to show than drop)
    const ageMs = Date.now() - pubDate.getTime();
    const maxMs = maxAgeHours * 60 * 60 * 1000;
    return ageMs <= maxMs;
}

async function fetchSignals() {
    const signals = [];
    const now = new Date();

    // News feeds — strict 24h freshness filter
    for (const url of FEEDS) {
        try {
            console.log(`Fetching ${url}...`);
            const xml = await fetchUrl(url);
            
            const items = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/gi) || [];
            
            for (let i = 0; i < Math.min(items.length, 15); i++) {
                const itemXml = items[i];
                
                let titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                if (!titleMatch) continue;
                let text = titleMatch[1].trim();
                text = text.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
                
                let linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || itemXml.match(/<link[^>]*href="([^"]+)"/i);
                let linkUrl = '';
                if (linkMatch) {
                    linkUrl = (linkMatch[1] || '').trim();
                    linkUrl = linkUrl.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
                }
                
                let imgMatch = itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i) || itemXml.match(/<enclosure[^>]*url="([^"]+)"/i);
                let imgUrl = imgMatch ? imgMatch[1] : '';

                const pubDate = parsePubDate(itemXml);
                if (!isFresh(pubDate, MAX_AGE_HOURS)) continue;
                
                if (text && !text.includes('BBC News - World') && !text.includes('National Cyber Awareness System')) {
                    signals.push({
                        title: text,
                        url: linkUrl,
                        image: imgUrl,
                        pubDate: pubDate ? pubDate.toISOString() : null,
                        source: url
                    });
                }
            }
        } catch (e) {
            console.error(`Error fetching ${url}:`, e.message);
        }
    }

    // Cyber feed — keep last 5 CISA advisories regardless of age (they're slow-moving but important)
    try {
        console.log(`Fetching ${CYBER_FEED}...`);
        const xml = await fetchUrl(CYBER_FEED);
        const items = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
        for (let i = 0; i < Math.min(items.length, 5); i++) {
            const itemXml = items[i];
            let titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (!titleMatch) continue;
            let text = titleMatch[1].trim();
            text = text.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
            let linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
            let linkUrl = linkMatch ? (linkMatch[1] || '').trim() : '';
            const pubDate = parsePubDate(itemXml);
            signals.push({
                title: text,
                url: linkUrl,
                image: '',
                pubDate: pubDate ? pubDate.toISOString() : null,
                source: 'cisa'
            });
        }
    } catch (e) {
        console.error(`Error fetching cyber feed:`, e.message);
    }

    // Deduplicate by title
    const seen = new Set();
    const deduped = signals.filter(s => {
        const key = s.title.toLowerCase().substring(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort by pubDate descending (newest first), undated items last
    deduped.sort((a, b) => {
        if (!a.pubDate && !b.pubDate) return 0;
        if (!a.pubDate) return 1;
        if (!b.pubDate) return -1;
        return new Date(b.pubDate) - new Date(a.pubDate);
    });

    return deduped;
}

// Procedurally generate a rich interconnected ontology from headlines
function buildProceduralOntology(signals) {
    const nodes = [];
    const links = [];
    
    nodes.push({ id: "intel_nexus", group: 0, label: "JerryKnows", size: 24 });
    
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

    // Process headlines (already sorted newest-first by fetchSignals)
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
            image: sigObj.image,
            pubDate: sigObj.pubDate || null,
            source: sigObj.source || ''
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

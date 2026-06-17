const fs = require('fs');
let code = fs.readFileSync('shell.js', 'utf8');
code = code.replace(/initOrUpdateGlobe\(baselineRecommendationPrioritySummary\.items \|\| \[\]\);/g, 'if (typeof initOrUpdateGlobe === "function") initOrUpdateGlobe(baselineRecommendationPrioritySummary.items || []);');
code = code.replace(/initOrUpdateGlobe\(refreshedPrioritySummary\.items \|\| \[\]\);/g, 'if (typeof initOrUpdateGlobe === "function") initOrUpdateGlobe(refreshedPrioritySummary.items || []);');
fs.writeFileSync('shell.js', code);

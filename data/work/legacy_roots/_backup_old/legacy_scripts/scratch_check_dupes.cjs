const fs = require('fs');
const content = fs.readFileSync('cargador_lotes_v_2.js', 'utf8');

// Regex for 'function myFunc(' or 'const myFunc = '
const funcRegex = /(?:function\s+([a-zA-Z0-9_]+)\s*\()|(?:(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>))/g;

const counts = {};
let match;
while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    if (name) {
        counts[name] = (counts[name] || 0) + 1;
    }
}

const duplicates = Object.entries(counts).filter(([name, count]) => count > 1);

if (duplicates.length > 0) {
    console.log("Found duplicate function names:");
    duplicates.forEach(([name, count]) => console.log(`${name}: ${count} times`));
} else {
    console.log("No duplicate functions found.");
}

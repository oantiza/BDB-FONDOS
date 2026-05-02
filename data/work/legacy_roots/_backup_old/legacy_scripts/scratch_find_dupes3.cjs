const fs = require('fs');
const lines = fs.readFileSync('cargador_lotes_v_2.js', 'utf8').split('\n');

const countMap = {};

for (let i=0; i<lines.length; i++) {
   const line = lines[i].trim();
   if (line.startsWith('function ') || line.startsWith('async function ') || line.startsWith('const REGION_MAPPINGS')) {
      const parts = line.split('(');
      let name = parts[0].trim();
      if (!countMap[name]) countMap[name] = [];
      countMap[name].push(i+1);
   }
}

for (const [k, v] of Object.entries(countMap)) {
   if (v.length > 1) {
      console.log(`DUPLICATE: ${k} at lines ${v.join(', ')}`);
   }
}

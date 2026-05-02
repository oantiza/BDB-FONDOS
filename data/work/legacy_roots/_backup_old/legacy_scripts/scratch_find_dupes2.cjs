const fs = require('fs');
const lines = fs.readFileSync('cargador_lotes_v_2.js', 'utf8').split('\n');

for (let i=0; i<lines.length; i++) {
   if (lines[i].includes('const REGION_MAPPINGS')) {
      console.log('REGION_MAPPINGS at line: ' + i);
   }
   if (lines[i].includes('extraerMSConGemini')) {
      console.log('extraerMSConGemini at line: ' + i);
   }
}
